use crate::db::Database;
use crate::models::{Email, MailAccount, MailFolder};
use crate::commands::email_secure::*;
use tempfile::TempDir;
use sqlx::SqlitePool;
use std::path::Path;

// Test database setup
pub async fn setup_test_db() -> (Database, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let db_url = format!("sqlite:{}", db_path.display());
    
    let pool = SqlitePool::connect(&db_url).await.unwrap();
    
    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    
    let db = Database { pool };
    
    // Initialize database schema
    init_database(&db).await.unwrap();
    
    (db, temp_dir)
}

// Test data creation
pub fn create_test_account() -> MailAccount {
    MailAccount {
        id: "test-account-1".to_string(),
        name: "Test Account".to_string(),
        email: "test@example.com".to_string(),
        imap_server: "imap.example.com".to_string(),
        imap_port: 993,
        imap_username: "test@example.com".to_string(),
        smtp_server: "smtp.example.com".to_string(),
        smtp_port: 587,
        smtp_username: "test@example.com".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    }
}

pub fn create_test_email(folder_id: &str) -> Email {
    Email {
        id: format!("{}-test-email-1", folder_id),
        folder_id: folder_id.to_string(),
        uid: 1,
        from: "sender@example.com".to_string(),
        to: "recipient@example.com".to_string(),
        cc: None,
        bcc: None,
        subject: "Test Email".to_string(),
        body: "This is a test email body.".to_string(),
        html_body: Some("<p>This is a test email body.</p>".to_string()),
        date: chrono::Utc::now().to_rfc3339(),
        read: false,
        starred: false,
        has_attachments: false,
        message_id: "test-message-id@example.com".to_string(),
        in_reply_to: None,
        references: None,
    }
}

pub fn create_test_folder(account_id: &str) -> MailFolder {
    MailFolder {
        id: format!("{}-INBOX", account_id),
        account_id: account_id.to_string(),
        name: "INBOX".to_string(),
        delimiter: ".".to_string(),
        selectable: true,
        has_children: false,
        total_messages: 0,
        unread_messages: 0,
    }
}

// Mock IMAP/SMTP responses
pub mod mock_server {
    use wiremock::{MockServer, Mock, ResponseTemplate};
    use wiremock::matchers::{method, path};
    
    pub async fn setup_mock_imap() -> MockServer {
        let server = MockServer::start().await;
        
        Mock::given(method("LOGIN"))
            .respond_with(ResponseTemplate::new(200).set_body_string("OK LOGIN completed"))
            .mount(&server)
            .await;
            
        Mock::given(method("SELECT"))
            .respond_with(ResponseTemplate::new(200).set_body_string("OK SELECT completed"))
            .mount(&server)
            .await;
            
        Mock::given(method("FETCH"))
            .respond_with(ResponseTemplate::new(200).set_body_string("OK FETCH completed"))
            .mount(&server)
            .await;
            
        server
    }
    
    pub async fn setup_mock_smtp() -> MockServer {
        let server = MockServer::start().await;
        
        Mock::given(method("EHLO"))
            .respond_with(ResponseTemplate::new(200).set_body_string("250 OK"))
            .mount(&server)
            .await;
            
        Mock::given(method("MAIL FROM"))
            .respond_with(ResponseTemplate::new(200).set_body_string("250 OK"))
            .mount(&server)
            .await;
            
        Mock::given(method("RCPT TO"))
            .respond_with(ResponseTemplate::new(200).set_body_string("250 OK"))
            .mount(&server)
            .await;
            
        Mock::given(method("DATA"))
            .respond_with(ResponseTemplate::new(200).set_body_string("250 OK"))
            .mount(&server)
            .await;
            
        server
    }
}

// Performance testing utilities
pub mod performance {
    use std::time::{Duration, Instant};
    use criterion::{black_box, Criterion};
    
    pub fn benchmark_email_parsing(c: &mut Criterion) {
        let raw_email = include_str!("../fixtures/sample_email.eml");
        
        c.bench_function("parse_email", |b| {
            b.iter(|| {
                black_box(mail_parser::Mail::parse(black_box(raw_email).as_bytes()).unwrap())
            })
        });
    }
    
    pub fn measure_db_operation<T, F>(operation: F) -> (T, Duration)
    where
        F: FnOnce() -> T,
    {
        let start = Instant::now();
        let result = operation();
        let duration = start.elapsed();
        (result, duration)
    }
}

// Security testing utilities
pub mod security {
    use crate::crypto::encrypt_password;
    use crate::crypto::decrypt_password;
    
    pub fn test_password_encryption(password: &str) -> bool {
        let encrypted = encrypt_password(password).unwrap();
        let decrypted = decrypt_password(&encrypted).unwrap();
        password == decrypted
    }
    
    pub fn test_sql_injection_resistance(input: &str) -> bool {
        // Test if input contains SQL injection patterns
        let injection_patterns = [
            "DROP TABLE",
            "DELETE FROM",
            "INSERT INTO",
            "UPDATE SET",
            "UNION SELECT",
            "' OR '1'='1",
            "\" OR \"1\"=\"1",
            "'; DROP TABLE",
            "\"; DELETE FROM",
        ];
        
        let input_upper = input.to_uppercase();
        !injection_patterns.iter().any(|pattern| input_upper.contains(pattern))
    }
}

// Integration test helpers
pub mod integration {
    use crate::db::Database;
    use crate::commands::email_secure::*;
    use crate::test_utils::create_test_account;
    use tauri::test::MockRuntime;
    
    pub async fn setup_full_test_environment() -> (Database, tauri::AppHandle<MockRuntime>) {
        let (db, _temp_dir) = super::setup_test_db().await;
        let app = tauri::test::mock_app();
        
        // Save test account
        let account = create_test_account();
        save_account_secure(db.clone(), app.clone(), account).await.unwrap();
        
        (db, app)
    }
    
    pub async fn test_email_workflow(db: Database, app: tauri::AppHandle<tauri::test::MockRuntime>) {
        // Test account retrieval
        let accounts = get_accounts_secure(db.clone(), app.clone()).await.unwrap();
        assert!(!accounts.is_empty());
        
        // Test folder sync
        let folders = sync_folders_secure(db.clone(), app.clone(), accounts[0].id.clone()).await.unwrap();
        assert!(!folders.is_empty());
        
        // Test email fetch
        let emails = fetch_emails_secure(db.clone(), app.clone(), accounts[0].id.clone(), "INBOX".to_string()).await.unwrap();
        // Emails might be empty in test environment, but the operation should succeed
    }
}
