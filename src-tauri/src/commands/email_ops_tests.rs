#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::*;
    use serial_test::serial;
    
    #[tokio::test]
    #[serial]
    async fn test_database_initialization() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Test that we can create tables
        let result = sqlx::query("SELECT name FROM sqlite_master WHERE type='table'")
            .fetch_all(&db.pool)
            .await;
            
        assert!(result.is_ok());
        let tables = result.unwrap();
        assert!(!tables.is_empty());
    }
    
    #[tokio::test]
    #[serial]
    async fn test_account_crud_operations() {
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();
        
        // Test account creation
        let account = create_test_account();
        let result = save_account_secure(db.clone(), app.clone(), account.clone()).await;
        assert!(result.is_ok());
        
        // Test account retrieval
        let accounts = get_accounts_secure(db.clone(), app.clone()).await.unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].email, account.email);
        
        // Test account deletion
        let result = delete_account_secure(db.clone(), app.clone(), account.id.clone()).await;
        assert!(result.is_ok());
        
        let accounts = get_accounts_secure(db.clone(), app.clone()).await.unwrap();
        assert_eq!(accounts.len(), 0);
    }
    
    #[tokio::test]
    #[serial]
    async fn test_email_crud_operations() {
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();
        
        // Setup account and folder
        let account = create_test_account();
        save_account_secure(db.clone(), app.clone(), account.clone()).await.unwrap();
        
        let folder = create_test_folder(&account.id);
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
        
        // Test email creation
        let email = create_test_email(&folder.id);
        let result = save_email(db.clone(), email.clone()).await;
        assert!(result.is_ok());
        
        // Test email retrieval
        let emails = get_emails_by_folder(db.clone(), folder.id.clone()).await.unwrap();
        assert_eq!(emails.len(), 1);
        assert_eq!(emails[0].subject, email.subject);
        
        // Test email update
        let updated_email = Email {
            read: true,
            ..email.clone()
        };
        let result = update_email(db.clone(), updated_email).await;
        assert!(result.is_ok());
        
        // Test email deletion
        let result = delete_email(db.clone(), email.id.clone()).await;
        assert!(result.is_ok());
        
        let emails = get_emails_by_folder(db.clone(), folder.id).await.unwrap();
        assert_eq!(emails.len(), 0);
    }
    
    #[tokio::test]
    #[serial]
    async fn test_folder_operations() {
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();
        
        // Setup account
        let account = create_test_account();
        save_account_secure(db.clone(), app.clone(), account.clone()).await.unwrap();
        
        // Test folder creation
        let result = create_folder(db.clone(), app.clone(), account.id.clone(), "TestFolder".to_string()).await;
        assert!(result.is_ok());
        
        let folder_id = result.unwrap();
        
        // Test folder retrieval
        let folders = get_folders_by_account(db.clone(), account.id.clone()).await.unwrap();
        assert!(!folders.is_empty());
        
        // Test folder rename
        let result = rename_folder(db.clone(), app.clone(), account.id.clone(), "TestFolder".to_string(), "RenamedFolder".to_string()).await;
        assert!(result.is_ok());
        
        // Test folder deletion
        let result = delete_folder(db.clone(), app.clone(), account.id.clone(), "RenamedFolder".to_string()).await;
        assert!(result.is_ok());
    }
    
    #[tokio::test]
    #[serial]
    async fn test_email_search() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Setup test data
        let account = create_test_account();
        let folder = create_test_folder(&account.id);
        let email = create_test_email(&folder.id);
        
        // Save test data
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
        
        save_email(db.clone(), email.clone()).await.unwrap();
        
        // Test search functionality
        let search_query = crate::commands::search::SearchQuery {
            query: "Test".to_string(),
            account_id: Some(account.id),
            folder_id: Some(folder.id),
            date_from: None,
            date_to: None,
            sender: None,
            subject_contains: None,
            body_contains: None,
            has_attachments: None,
            is_read: None,
            is_starred: None,
            limit: Some(10),
            offset: Some(0),
        };
        
        let result = crate::commands::search::search_emails(db.clone(), search_query).await;
        assert!(result.is_ok());
        
        let search_result = result.unwrap();
        assert_eq!(search_result.emails.len(), 1);
        assert_eq!(search_result.total_count, 1);
    }
    
    #[tokio::test]
    #[serial]
    async fn test_attachment_operations() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Setup test email
        let account = create_test_account();
        let folder = create_test_folder(&account.id);
        let email = create_test_email(&folder.id);
        
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
        
        save_email(db.clone(), email.clone()).await.unwrap();
        
        // Test attachment upload
        let attachment = crate::commands::attachments::AttachmentUpload {
            filename: "test.txt".to_string(),
            content_type: "text/plain".to_string(),
            size: 12,
            content: b"Hello World!".to_vec(),
        };
        
        let result = crate::commands::attachments::upload_attachment(db.clone(), email.id.clone(), attachment).await;
        assert!(result.is_ok());
        
        let attachment_id = result.unwrap();
        
        // Test attachment retrieval
        let attachments = crate::commands::attachments::get_email_attachments(db.clone(), email.id.clone()).await.unwrap();
        assert_eq!(attachments.len(), 1);
        
        // Test attachment download
        let content = crate::commands::attachments::download_attachment(db.clone(), attachment_id).await.unwrap();
        assert_eq!(content, b"Hello World!");
        
        // Test attachment deletion
        let result = crate::commands::attachments::delete_attachment(db.clone(), attachment_id).await;
        assert!(result.is_ok());
        
        let attachments = crate::commands::attachments::get_email_attachments(db.clone(), email.id).await.unwrap();
        assert_eq!(attachments.len(), 0);
    }
    
    #[tokio::test]
    #[serial]
    async fn test_bulk_email_operations() {
        let (db, _temp_dir) = setup_test_db().await;
        
        // Setup test data
        let account = create_test_account();
        let folder = create_test_folder(&account.id);
        
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
        
        // Create multiple emails
        let mut email_ids = Vec::new();
        for i in 0..5 {
            let mut email = create_test_email(&folder.id);
            email.id = format!("{}-test-email-{}", folder.id, i);
            email.subject = format!("Test Email {}", i);
            save_email(db.clone(), email.clone()).await.unwrap();
            email_ids.push(email.id);
        }
        
        // Test bulk mark as read
        let result = crate::commands::email_actions::mark_emails_as_read(db.clone(), tauri::test::mock_app(), account.id.clone(), email_ids.clone()).await;
        assert!(result.is_ok());
        
        // Verify emails are marked as read
        for email_id in &email_ids {
            let email = get_email_by_id(db.clone(), email_id.clone()).await.unwrap();
            assert!(email.read);
        }
        
        // Test bulk star
        let result = crate::commands::email_actions::star_emails(db.clone(), tauri::test::mock_app(), account.id.clone(), email_ids.clone()).await;
        assert!(result.is_ok());
        
        // Verify emails are starred
        for email_id in &email_ids {
            let email = get_email_by_id(db.clone(), email_id.clone()).await.unwrap();
            assert!(email.starred);
        }
        
        // Test bulk delete
        let result = crate::commands::email_actions::delete_emails(db.clone(), tauri::test::mock_app(), account.id.clone(), email_ids.clone()).await;
        assert!(result.is_ok());
        
        // Verify emails are deleted
        for email_id in &email_ids {
            let result = get_email_by_id(db.clone(), email_id.clone()).await;
            assert!(result.is_err()); // Should not exist
        }
    }
}
