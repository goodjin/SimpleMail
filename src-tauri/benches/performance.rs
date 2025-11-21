use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mail_parser::Mail;
use crate::test_utils::*;
use crate::commands::search::*;
use crate::crypto::{encrypt_password, decrypt_password};

fn benchmark_email_parsing(c: &mut Criterion) {
    let raw_email = include_str!("../fixtures/sample_email.eml");
    
    c.bench_function("parse_email", |b| {
        b.iter(|| {
            black_box(Mail::parse(black_box(raw_email).as_bytes()).unwrap())
        })
    });

    c.bench_function("parse_email_large", |b| {
        let large_email = create_large_test_email();
        b.iter(|| {
            black_box(Mail::parse(black_box(&large_email).as_bytes()).unwrap())
        })
    });
}

fn benchmark_database_operations(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    c.bench_function("save_email", |b| {
        b.to_async(&rt).iter(|| async {
            let (db, _temp_dir) = setup_test_db().await;
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            let email = create_test_email(&folder.id);
            
            black_box(save_email(db.clone(), email).await.unwrap())
        })
    });

    c.bench_function("get_emails_by_folder", |b| {
        b.to_async(&rt).iter(|| async {
            let (db, _temp_dir) = setup_test_db().await;
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            
            // Create test emails
            for i in 0..100 {
                let mut email = create_test_email(&folder.id);
                email.id = format!("{}-email-{}", folder.id, i);
                save_email(db.clone(), email).await.unwrap();
            }
            
            black_box(get_emails_by_folder(db.clone(), folder.id).await.unwrap())
        })
    });

    c.bench_function("search_emails", |b| {
        b.to_async(&rt).iter(|| async {
            let (db, _temp_dir) = setup_test_db().await;
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            
            // Create test emails
            for i in 0..1000 {
                let mut email = create_test_email(&folder.id);
                email.id = format!("{}-email-{}", folder.id, i);
                email.subject = format!("Test Subject {}", i);
                save_email(db.clone(), email).await.unwrap();
            }
            
            let search_query = SearchQuery {
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
                limit: Some(50),
                offset: Some(0),
            };
            
            black_box(search_emails(db.clone(), search_query).await.unwrap())
        })
    });
}

fn benchmark_crypto_operations(c: &mut Criterion) {
    let password = "test_password_123";
    
    c.bench_function("encrypt_password", |b| {
        b.iter(|| {
            black_box(encrypt_password(black_box(password)).unwrap())
        })
    });

    c.bench_function("decrypt_password", |b| {
        let encrypted = encrypt_password(password).unwrap();
        b.iter(|| {
            black_box(decrypt_password(black_box(&encrypted)).unwrap())
        })
    });
}

fn benchmark_attachment_operations(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    c.bench_function("upload_small_attachment", |b| {
        b.to_async(&rt).iter(|| async {
            let (db, _temp_dir) = setup_test_db().await;
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            let email = create_test_email(&folder.id);
            
            save_email(db.clone(), email.clone()).await.unwrap();
            
            let attachment = crate::commands::attachments::AttachmentUpload {
                filename: "small.txt".to_string(),
                content_type: "text/plain".to_string(),
                size: 1024,
                content: vec![0; 1024],
            };
            
            black_box(upload_attachment(db.clone(), email.id, attachment).await.unwrap())
        })
    });

    c.bench_function("upload_large_attachment", |b| {
        b.to_async(&rt).iter(|| async {
            let (db, _temp_dir) = setup_test_db().await;
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            let email = create_test_email(&folder.id);
            
            save_email(db.clone(), email.clone()).await.unwrap();
            
            let attachment = crate::commands::attachments::AttachmentUpload {
                filename: "large.txt".to_string(),
                content_type: "text/plain".to_string(),
                size: 10 * 1024 * 1024, // 10MB
                content: vec![0; 10 * 1024 * 1024],
            };
            
            black_box(upload_attachment(db.clone(), email.id, attachment).await.unwrap())
        })
    });
}

fn benchmark_bulk_operations(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    c.bench_function("bulk_mark_as_read_100", |b| {
        b.to_async(&rt).iter(|| async {
            let (db, _temp_dir) = setup_test_db().await;
            let app = tauri::test::mock_app();
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            
            // Create test emails
            let mut email_ids = Vec::new();
            for i in 0..100 {
                let mut email = create_test_email(&folder.id);
                email.id = format!("{}-email-{}", folder.id, i);
                save_email(db.clone(), email.clone()).await.unwrap();
                email_ids.push(email.id);
            }
            
            black_box(
                crate::commands::email_actions::mark_emails_as_read(
                    db.clone(), 
                    app, 
                    account.id, 
                    email_ids
                ).await.unwrap()
            )
        })
    });

    c.bench_function("bulk_delete_100", |b| {
        b.to_async(&rt).iter(|| async {
            let (db, _temp_dir) = setup_test_db().await;
            let app = tauri::test::mock_app();
            let account = create_test_account();
            let folder = create_test_folder(&account.id);
            
            // Create test emails
            let mut email_ids = Vec::new();
            for i in 0..100 {
                let mut email = create_test_email(&folder.id);
                email.id = format!("{}-email-{}", folder.id, i);
                save_email(db.clone(), email.clone()).await.unwrap();
                email_ids.push(email.id);
            }
            
            black_box(
                crate::commands::email_actions::delete_emails(
                    db.clone(), 
                    app, 
                    account.id, 
                    email_ids
                ).await.unwrap()
            )
        })
    });
}

// Helper functions
fn create_large_test_email() -> String {
    let mut email = String::new();
    email.push_str("From: sender@example.com\n");
    email.push_str("To: recipient@example.com\n");
    email.push_str("Subject: Large Test Email\n");
    email.push_str("Date: Mon, 1 Jan 2023 10:00:00 +0000\n");
    email.push_str("Content-Type: text/plain; charset=utf-8\n\n");
    
    // Add large body
    for i in 0..1000 {
        email.push_str(&format!("This is line {} of the large email body.\n", i));
    }
    
    email
}

fn benchmark_memory_usage(c: &mut Criterion) {
    c.bench_function("memory_usage_1000_emails", |b| {
        b.iter(|| {
            let mut emails = Vec::new();
            for i in 0..1000 {
                let email = create_test_email(&format!("folder-{}", i % 10));
                emails.push(email);
            }
            black_box(emails)
        })
    });
}

criterion_group!(
    benches,
    benchmark_email_parsing,
    benchmark_database_operations,
    benchmark_crypto_operations,
    benchmark_attachment_operations,
    benchmark_bulk_operations,
    benchmark_memory_usage
);

criterion_main!(benches);
