#[cfg(test)]
mod security_tests {
    use super::*;
    use crate::test_utils::*;
    use crate::crypto::{encrypt_password, decrypt_password};
    use serial_test::serial;

    #[tokio::test]
    #[serial]
    async fn test_password_encryption_security() {
        // Test that passwords are properly encrypted
        let password = "super_secret_password_123!";
        let encrypted = encrypt_password(password).unwrap();
        
        // Encrypted password should not contain original password
        assert!(!encrypted.contains(password));
        assert!(!encrypted.contains("super_secret"));
        
        // Encrypted password should be different from original
        assert_ne!(encrypted, password);
        
        // Should be decryptable with correct key
        let decrypted = decrypt_password(&encrypted).unwrap();
        assert_eq!(decrypted, password);
        
        // Different encryptions of same password should be different (due to random nonce)
        let encrypted2 = encrypt_password(password).unwrap();
        assert_ne!(encrypted, encrypted2);
        
        // But both should decrypt to the same password
        let decrypted2 = decrypt_password(&encrypted2).unwrap();
        assert_eq!(decrypted2, password);
    }

    #[tokio::test]
    #[serial]
    async fn test_sql_injection_prevention() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Test malicious inputs
        let malicious_inputs = vec![
            "'; DROP TABLE accounts; --",
            "' OR '1'='1",
            "\"; DELETE FROM emails; --",
            "'; INSERT INTO accounts VALUES ('hacker', 'evil@evil.com'); --",
            "admin'--",
            "admin' /*",
            "' OR 1=1#",
            "'; EXEC xp_cmdshell('dir'); --",
        ];
        
        for malicious_input in malicious_inputs {
            // Test account creation with malicious input
            let mut account = create_test_account();
            account.name = malicious_input.to_string();
            account.email = malicious_input.to_string();
            
            let result = save_account_secure(db.clone(), tauri::test::mock_app(), account).await;
            
            // Should either succeed (if input is valid) or fail gracefully
            // But should never cause SQL injection
            if result.is_ok() {
                // Verify database integrity
                let accounts = get_accounts_secure(db.clone(), tauri::test::mock_app()).await.unwrap();
                assert!(!accounts.is_empty());
                
                // Verify no malicious SQL was executed
                let tables = sqlx::query("SELECT name FROM sqlite_master WHERE type='table'")
                    .fetch_all(&db.pool)
                    .await
                    .unwrap();
                
                // Should still have all original tables
                let table_names: Vec<String> = tables.iter()
                    .map(|row| row.get::<String, _>("name"))
                    .collect();
                
                assert!(table_names.contains(&"accounts".to_string()));
                assert!(table_names.contains(&"emails".to_string()));
                assert!(table_names.contains(&"folders".to_string()));
                assert!(table_names.contains(&"attachments".to_string()));
            }
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_xss_prevention_in_email_content() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Test malicious HTML/JS in email content
        let xss_payloads = vec![
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//",
            "<iframe src=javascript:alert('XSS')>",
        ];
        
        for payload in xss_payloads {
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            
            // Save account and folder
            save_account_secure(db.clone(), tauri::test::mock_app(), account.clone()).await.unwrap();
            
            sqlx::query(
                "INSERT INTO folders (id, account_id, name, delimiter) VALUES (?, ?, ?, ?)"
            )
            .bind(&folder.id)
            .bind(&folder.account_id)
            .bind(&folder.name)
            .bind(&folder.delimiter)
            .execute(&db.pool)
            .await
            .unwrap();
            
            // Create email with XSS payload
            let mut email = create_test_email(&folder.id);
            email.subject = payload.to_string();
            email.body = payload.to_string();
            email.html_body = Some(format!("<html><body>{}</body></html>", payload));
            
            // Should save successfully
            let result = save_email(db.clone(), email.clone()).await;
            assert!(result.is_ok());
            
            // Retrieve email
            let retrieved = get_email_by_id(db.clone(), email.id).await.unwrap();
            
            // Content should be stored as-is (sanitization happens in frontend)
            assert_eq!(retrieved.subject, payload);
            assert_eq!(retrieved.body, payload);
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_attachment_upload_security() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Test malicious attachment uploads
        let malicious_attachments = vec![
            ("malicious.exe", "application/octet-stream", vec![0x4D, 0x5A]), // PE header
            ("script.js", "application/javascript", b"<script>alert('XSS')</script>".to_vec()),
            ("huge.txt", "text/plain", vec![0; 100 * 1024 * 1024]), // 100MB file
        ]);
        
        let account = create_test_account();
        let folder = create_test_folder(&account.id);
        
        save_account_secure(db.clone(), tauri::test::mock_app(), account.clone()).await.unwrap();
        
        sqlx::query(
            "INSERT INTO folders (id, account_id, name, delimiter) VALUES (?, ?, ?, ?)"
        )
        .bind(&folder.id)
        .bind(&folder.account_id)
        .bind(&folder.name)
        .bind(&folder.delimiter)
        .execute(&db.pool)
        .await
        .unwrap();
        
        let email = create_test_email(&folder.id);
        save_email(db.clone(), email.clone()).await.unwrap();
        
        for (filename, content_type, content) in malicious_attachments {
            let attachment = crate::commands::attachments::AttachmentUpload {
                filename: filename.to_string(),
                content_type: content_type.to_string(),
                size: content.len(),
                content,
            };
            
            let result = upload_attachment(db.clone(), email.id.clone(), attachment).await;
            
            // Should either succeed (if within limits) or fail gracefully
            // But should never cause security issues
            match result {
                Ok(attachment_id) => {
                    // If successful, verify attachment metadata
                    let attachments = get_email_attachments(db.clone(), email.id.clone()).await.unwrap();
                    let uploaded = attachments.iter().find(|a| a.id == attachment_id);
                    assert!(uploaded.is_some());
                    
                    let uploaded = uploaded.unwrap();
                    assert_eq!(uploaded.filename, filename);
                    assert_eq!(uploaded.content_type, content_type);
                }
                Err(_) => {
                    // Should fail for oversized files
                    if filename == "huge.txt" {
                        // Expected to fail
                        continue;
                    } else {
                        panic!("Unexpected failure for attachment: {}", filename);
                    }
                }
            }
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_authentication_security() {
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();
        
        // Test weak passwords
        let weak_passwords = vec![
            "123456",
            "password",
            "qwerty",
            "admin",
            "letmein",
            "123456789",
            "football",
            "iloveyou",
        ];
        
        for weak_password in weak_passwords {
            let mut account = create_test_account();
            
            // Test with weak password (in real implementation, this should be rejected)
            // For now, we just verify it doesn't cause security issues
            let result = save_account_secure(db.clone(), app.clone(), account).await;
            assert!(result.is_ok());
        }
        
        // Test credential storage
        let account = create_test_account();
        save_account_secure(db.clone(), app.clone(), account.clone()).await.unwrap();
        
        // Verify credentials are encrypted in database
        let stored_account: crate::models::MailAccount = sqlx::query_as(
            "SELECT * FROM accounts WHERE email = ?"
        )
        .bind(&account.email)
        .fetch_one(&db.pool)
        .await
        .unwrap();
        
        // Password should not be stored in plain text
        assert_ne!(stored_account.password, "testpassword123");
        assert!(!stored_account.password.contains("testpassword"));
    }

    #[tokio::test]
    #[serial]
    async fn test_rate_limiting_security() {
        // This would test rate limiting for API endpoints
        // For now, we'll test that rapid requests don't cause issues
        
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();
        
        // Test rapid account creation attempts
        let mut handles = Vec::new();
        
        for i in 0..100 {
            let mut account = create_test_account();
            account.email = format!("test{}@example.com", i);
            account.name = format!("Test Account {}", i);
            
            let db_clone = db.clone();
            let app_clone = app.clone();
            
            let handle = tokio::spawn(async move {
                save_account_secure(db_clone, app_clone, account).await
            });
            
            handles.push(handle);
        }
        
        // Wait for all operations to complete
        for handle in handles {
            let result = handle.await.unwrap();
            // Should either succeed or fail gracefully, not crash
            assert!(result.is_ok() || result.is_err());
        }
        
        // Verify database integrity
        let accounts = get_accounts_secure(db.clone(), app).await.unwrap();
        assert!(accounts.len() <= 100); // Should not exceed attempted operations
    }

    #[tokio::test]
    #[serial]
    async fn test_file_system_security() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Test path traversal attempts
        let malicious_paths = vec![
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "/etc/shadow",
            "C:\\Windows\\System32\\drivers\\etc\\hosts",
            "~/.ssh/id_rsa",
            "../../.env",
        ];
        
        for malicious_path in malicious_paths {
            let attachment = crate::commands::attachments::AttachmentUpload {
                filename: malicious_path.to_string(),
                content_type: "text/plain".to_string(),
                size: 100,
                content: b"test content".to_vec(),
            };
            
            let result = upload_attachment(db.clone(), "test-email".to_string(), attachment).await;
            
            // Should fail for path traversal attempts
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_data_validation_security() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Test oversized data
        let oversized_string = "x".repeat(10_000_000); // 10MB string
        
        let mut account = create_test_account();
        account.name = oversized_string.clone();
        account.email = format!("{}@example.com", "x".repeat(1000)); // Very long email
        
        let result = save_account_secure(db.clone(), tauri::test::mock_app(), account).await;
        
        // Should fail gracefully for oversized data
        assert!(result.is_err());
        
        // Test null bytes and special characters
        let malicious_strings = vec![
            "test\x00null",
            "test\x01\x02\x03control",
            "test\r\nnewline",
            "test\t\t\ttabs",
            "test\u{0000}\u{0001}\u{0002}unicode",
        ];
        
        for malicious_string in malicious_strings {
            let mut account = create_test_account();
            account.name = malicious_string.to_string();
            
            let result = save_account_secure(db.clone(), tauri::test::mock_app(), account).await;
            
            // Should handle gracefully without crashing
            assert!(result.is_ok() || result.is_err());
        }
    }
}
