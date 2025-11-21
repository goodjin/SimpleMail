use crate::test_utils::*;
use crate::commands::email_secure::*;
use crate::commands::folder_ops::*;
use crate::commands::email_actions::*;
use crate::commands::attachments::*;
use crate::commands::search::*;
use serial_test::serial;

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_complete_email_workflow() {
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();

        // Step 1: Setup account
        let account = create_test_account();
        save_account_secure(db.clone(), app.clone(), account.clone()).await.unwrap();

        // Step 2: Sync folders
        let folders = sync_folders_secure(db.clone(), app.clone(), account.id.clone()).await.unwrap();
        assert!(!folders.is_empty());

        // Step 3: Create custom folder
        let result = create_folder(db.clone(), app.clone(), account.id.clone(), "TestFolder".to_string()).await;
        assert!(result.is_ok());

        // Step 4: Fetch emails (mock)
        let emails = fetch_emails_secure(db.clone(), app.clone(), account.id.clone(), "INBOX".to_string()).await.unwrap();
        // Should succeed even if empty in test environment

        // Step 5: Create test email
        let folder = &folders[0];
        let email = create_test_email(&folder.id);
        save_email(db.clone(), email.clone()).await.unwrap();

        // Step 6: Test search functionality
        let search_query = SearchQuery {
            query: "Test".to_string(),
            account_id: Some(account.id.clone()),
            folder_id: Some(folder.id.clone()),
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

        let search_result = search_emails(db.clone(), search_query).await.unwrap();
        assert_eq!(search_result.emails.len(), 1);

        // Step 7: Test email actions
        mark_emails_as_read(db.clone(), app.clone(), account.id.clone(), vec![email.id.clone()]).await.unwrap();
        star_emails(db.clone(), app.clone(), account.id.clone(), vec![email.id.clone()]).await.unwrap();

        // Step 8: Test folder operations
        let result = rename_folder(db.clone(), app.clone(), account.id.clone(), "INBOX".to_string(), "RenamedINBOX".to_string()).await;
        assert!(result.is_ok());

        // Step 9: Cleanup
        delete_emails(db.clone(), app.clone(), account.id.clone(), vec![email.id]).await.unwrap();
        delete_folder(db.clone(), app.clone(), account.id.clone(), "RenamedINBOX".to_string()).await.unwrap();
        delete_account_secure(db.clone(), app.clone(), account.id).await.unwrap();
    }

    #[tokio::test]
    #[serial]
    async fn test_attachment_workflow() {
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();

        // Setup account and email
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

        let email = create_test_email(&folder.id);
        save_email(db.clone(), email.clone()).await.unwrap();

        // Test single attachment upload
        let attachment = crate::commands::attachments::AttachmentUpload {
            filename: "test.txt".to_string(),
            content_type: "text/plain".to_string(),
            size: 12,
            content: b"Hello World!".to_vec(),
        };

        let attachment_id = upload_attachment(db.clone(), email.id.clone(), attachment).await.unwrap();
        assert!(!attachment_id.is_empty());

        // Test attachment retrieval
        let attachments = get_email_attachments(db.clone(), email.id.clone()).await.unwrap();
        assert_eq!(attachments.len(), 1);

        // Test attachment download
        let content = download_attachment(db.clone(), attachment_id.clone()).await.unwrap();
        assert_eq!(content, b"Hello World!");

        // Test attachment preview
        let preview = get_attachment_preview(db.clone(), attachment_id.clone()).await.unwrap();
        assert_eq!(preview.filename, "test.txt");
        assert_eq!(preview.content_type, "text/plain");

        // Test attachment deletion
        delete_attachment(db.clone(), attachment_id).await.unwrap();
        let attachments = get_email_attachments(db.clone(), email.id).await.unwrap();
        assert_eq!(attachments.len(), 0);
    }

    #[tokio::test]
    #[serial]
    async fn test_bulk_operations_workflow() {
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

        // Create multiple emails
        let mut email_ids = Vec::new();
        for i in 0..10 {
            let mut email = create_test_email(&folder.id);
            email.id = format!("{}-test-email-{}", folder.id, i);
            email.subject = format!("Test Email {}", i);
            save_email(db.clone(), email.clone()).await.unwrap();
            email_ids.push(email.id);
        }

        // Test bulk mark as read
        let result = mark_emails_as_read(db.clone(), app.clone(), account.id.clone(), email_ids.clone()).await;
        assert!(result.is_ok());

        // Verify all emails are marked as read
        for email_id in &email_ids {
            let email = get_email_by_id(db.clone(), email_id.clone()).await.unwrap();
            assert!(email.read);
        }

        // Test bulk star
        let result = star_emails(db.clone(), app.clone(), account.id.clone(), email_ids.clone()).await;
        assert!(result.is_ok());

        // Verify all emails are starred
        for email_id in &email_ids {
            let email = get_email_by_id(db.clone(), email_id.clone()).await.unwrap();
            assert!(email.starred);
        }

        // Test bulk move to another folder
        let target_folder = format!("{}-TestFolder", account.id);
        create_folder(db.clone(), app.clone(), account.id.clone(), "TestFolder".to_string()).await.unwrap();

        let result = bulk_move_emails(db.clone(), app.clone(), account.id.clone(), email_ids.clone(), target_folder.clone()).await;
        assert!(result.is_ok());

        // Verify emails are moved
        for email_id in &email_ids {
            let email = get_email_by_id(db.clone(), email_id.clone()).await.unwrap();
            assert_eq!(email.folder_id, target_folder);
        }

        // Test bulk delete
        let result = delete_emails(db.clone(), app.clone(), account.id.clone(), email_ids.clone()).await;
        assert!(result.is_ok());

        // Verify emails are deleted
        for email_id in &email_ids {
            let result = get_email_by_id(db.clone(), email_id.clone()).await;
            assert!(result.is_err());
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_and_filter_workflow() {
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

        // Create diverse test emails
        let test_emails = vec![
            (Email {
                id: format!("{}-email-1", folder.id),
                folder_id: folder.id.clone(),
                uid: 1,
                from: "alice@example.com".to_string(),
                to: "bob@example.com".to_string(),
                cc: None,
                bcc: None,
                subject: "Project Update".to_string(),
                body: "Here is the latest project update...".to_string(),
                html_body: Some("<p>Here is the latest project update...</p>".to_string()),
                date: "2023-01-01T10:00:00Z".to_string(),
                read: true,
                starred: false,
                has_attachments: true,
                message_id: "msg1@example.com".to_string(),
                in_reply_to: None,
                references: None,
            }, true, false), // has attachments, not starred

            (Email {
                id: format!("{}-email-2", folder.id),
                folder_id: folder.id.clone(),
                uid: 2,
                from: "bob@example.com".to_string(),
                to: "alice@example.com".to_string(),
                cc: None,
                bcc: None,
                subject: "Meeting Notes".to_string(),
                body: "Notes from today's meeting...".to_string(),
                html_body: Some("<p>Notes from today's meeting...</p>".to_string()),
                date: "2023-01-02T14:30:00Z".to_string(),
                read: false,
                starred: true,
                has_attachments: false,
                message_id: "msg2@example.com".to_string(),
                in_reply_to: None,
                references: None,
            }, false, true), // no attachments, starred

            (Email {
                id: format!("{}-email-3", folder.id),
                folder_id: folder.id.clone(),
                uid: 3,
                from: "charlie@example.com".to_string(),
                to: "team@example.com".to_string(),
                cc: None,
                bcc: None,
                subject: "Budget Proposal".to_string(),
                body: "Please review the attached budget proposal...".to_string(),
                html_body: Some("<p>Please review the attached budget proposal...</p>".to_string()),
                date: "2023-01-03T09:15:00Z".to_string(),
                read: false,
                starred: false,
                has_attachments: true,
                message_id: "msg3@example.com".to_string(),
                in_reply_to: None,
                references: None,
            }, true, false), // has attachments, not starred
        ];

        // Save test emails
        for (email, _, _) in &test_emails {
            save_email(db.clone(), email.clone()).await.unwrap();
        }

        // Test search by subject
        let search_query = SearchQuery {
            query: "project".to_string(),
            account_id: Some(account.id.clone()),
            folder_id: Some(folder.id.clone()),
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

        let result = search_emails(db.clone(), search_query).await.unwrap();
        assert_eq!(result.emails.len(), 1);
        assert!(result.emails[0].subject.contains("project"));

        // Test search by sender
        let search_query = SearchQuery {
            query: String::new(),
            account_id: Some(account.id.clone()),
            folder_id: Some(folder.id.clone()),
            date_from: None,
            date_to: None,
            sender: Some("alice@example.com".to_string()),
            subject_contains: None,
            body_contains: None,
            has_attachments: None,
            is_read: None,
            is_starred: None,
            limit: Some(10),
            offset: Some(0),
        };

        let result = search_emails(db.clone(), search_query).await.unwrap();
        assert_eq!(result.emails.len(), 1);
        assert_eq!(result.emails[0].from, "alice@example.com");

        // Test filter by attachments
        let search_query = SearchQuery {
            query: String::new(),
            account_id: Some(account.id.clone()),
            folder_id: Some(folder.id.clone()),
            date_from: None,
            date_to: None,
            sender: None,
            subject_contains: None,
            body_contains: None,
            has_attachments: Some(true),
            is_read: None,
            is_starred: None,
            limit: Some(10),
            offset: Some(0),
        };

        let result = search_emails(db.clone(), search_query).await.unwrap();
        assert_eq!(result.emails.len(), 2);
        result.emails.iter().for_each(|email| assert!(email.hasAttachments));

        // Test filter by starred
        let search_query = SearchQuery {
            query: String::new(),
            account_id: Some(account.id.clone()),
            folder_id: Some(folder.id.clone()),
            date_from: None,
            date_to: None,
            sender: None,
            subject_contains: None,
            body_contains: None,
            has_attachments: None,
            is_read: None,
            is_starred: Some(true),
            limit: Some(10),
            offset: Some(0),
        };

        let result = search_emails(db.clone(), search_query).await.unwrap();
        assert_eq!(result.emails.len(), 1);
        result.emails.iter().for_each(|email| assert!(email.starred));

        // Test search suggestions
        let suggestions = get_search_suggestions(db.clone(), "project".to_string(), Some(5)).await.unwrap();
        assert!(!suggestions.is_empty());
        assert!(suggestions.iter().any(|s| s.contains("project")));
    }

    #[tokio::test]
    #[serial]
    async fn test_error_handling_and_recovery() {
        let (db, _temp_dir) = setup_test_db().await;
        let app = tauri::test::mock_app();

        // Test invalid account operations
        let invalid_account = create_test_account();
        let result = save_account_secure(db.clone(), app.clone(), invalid_account).await;
        assert!(result.is_ok());

        // Test operations on non-existent account
        let result = sync_folders_secure(db.clone(), app.clone(), "non-existent-account".to_string()).await;
        assert!(result.is_err());

        // Test operations on non-existent email
        let result = mark_emails_as_read(db.clone(), app.clone(), "non-existent-account".to_string(), vec!["non-existent-email".to_string()]).await;
        assert!(result.is_err());

        // Test folder operations with invalid names
        let account = create_test_account();
        save_account_secure(db.clone(), app.clone(), account.clone()).await.unwrap();

        let result = create_folder(db.clone(), app.clone(), account.id.clone(), "".to_string()).await;
        assert!(result.is_err());

        let result = rename_folder(db.clone(), app.clone(), account.id.clone(), "non-existent-folder".to_string(), "NewName".to_string()).await;
        assert!(result.is_err());

        // Test attachment operations on non-existent email
        let attachment = crate::commands::attachments::AttachmentUpload {
            filename: "test.txt".to_string(),
            content_type: "text/plain".to_string(),
            size: 12,
            content: b"Hello World!".to_vec(),
        };

        let result = upload_attachment(db.clone(), "non-existent-email".to_string(), attachment).await;
        assert!(result.is_err());

        // Test search with invalid parameters
        let search_query = SearchQuery {
            query: String::new(),
            account_id: Some("non-existent-account".to_string()),
            folder_id: None,
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

        let result = search_emails(db.clone(), search_query).await;
        assert!(result.is_ok()); // Should return empty result, not error
        assert_eq!(result.unwrap().emails.len(), 0);
    }
}
