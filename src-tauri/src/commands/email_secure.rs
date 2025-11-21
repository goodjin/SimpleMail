use crate::credentials::{store_credentials, retrieve_credentials, delete_credentials};
use crate::db::Database;
use crate::models::{Account, Email, Folder};
use crate::imap_client::{ImapClient, ImapConfig};
use crate::smtp_client::{SmtpClient, SmtpConfig, EmailMessage};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountConfig {
    pub name: String,
    pub email: String,
    pub imap_config: ImapConfig,
    pub smtp_config: SmtpConfig,
}

#[command]
pub async fn save_account_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, config: AccountConfig) -> Result<String, String> {
    let account_id = uuid::Uuid::new_v4().to_string();
    
    // Store passwords securely
    store_credentials(&app_handle, &account_id, &config.imap_config.password).await?;
    
    // Save account without passwords
    sqlx::query(
        r#"
        INSERT INTO accounts (id, email, name, provider, imap_host, imap_port, imap_username, 
                              smtp_host, smtp_port, smtp_username)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&account_id)
    .bind(&config.email)
    .bind(&config.name)
    .bind("custom") // Default provider
    .bind(&config.imap_config.host)
    .bind(config.imap_config.port as i64)
    .bind(&config.imap_config.username)
    .bind(&config.smtp_config.host)
    .bind(config.smtp_config.port as i64)
    .bind(&config.smtp_config.username)
    .execute(&db.pool)
    .await
    .map_err(|e| format!("Failed to save account: {}", e))?;

    Ok(account_id)
}

#[command]
pub async fn get_accounts_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle) -> Result<Vec<Account>, String> {
    let accounts = sqlx::query("SELECT id, email, name, provider, imap_host, imap_port, smtp_host, smtp_port FROM accounts")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| format!("Failed to fetch accounts: {}", e))?;

    Ok(accounts)
}

#[command]
pub async fn get_account_with_credentials(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String) -> Result<AccountConfig, String> {
    // Get account from database
    let account = sqlx::query("SELECT * FROM accounts WHERE id = ?")
        .bind(&account_id)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| format!("Failed to get account: {}", e))?;

    // Retrieve password securely
    let password = retrieve_credentials(&app_handle, &account_id).await?;

    let imap_config = ImapConfig {
        host: account.get("imap_host"),
        port: account.get::<i64, _>("imap_port") as u16,
        username: account.get("imap_username"),
        password,
        tls: true,
    };

    let smtp_config = SmtpConfig {
        host: account.get("smtp_host"),
        port: account.get::<i64, _>("smtp_port") as u16,
        username: account.get("smtp_username"),
        password: password.clone(), // Use same password for SMTP
        from: account.get("email"),
    };

    Ok(AccountConfig {
        name: account.get("name"),
        email: account.get("email"),
        imap_config,
        smtp_config,
    })
}

#[command]
pub async fn delete_account_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String) -> Result<(), String> {
    // Start transaction for cascading delete
    let mut tx = db.pool.begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Delete emails for this account
    sqlx::query("DELETE FROM emails WHERE account_id = ?")
        .bind(&account_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete emails: {}", e))?;

    // Delete folders for this account
    sqlx::query("DELETE FROM folders WHERE account_id = ?")
        .bind(&account_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete folders: {}", e))?;

    // Delete the account
    sqlx::query("DELETE FROM accounts WHERE id = ?")
        .bind(&account_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete account: {}", e))?;

    // Commit transaction
    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // Delete stored credentials
    delete_credentials(&app_handle, &account_id).await?;

    Ok(())
}

#[command]
pub async fn sync_folders_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String) -> Result<Vec<Folder>, String> {
    // Get account with credentials
    let config = get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    let imap_folders = client.list_folders()
        .map_err(|e| format!("Failed to list folders: {}", e))?;

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Save folders to database
    for folder in &imap_folders {
        let folder_id = format!("{}-{}", account_id, folder.name);
        sqlx::query(
            "INSERT OR REPLACE INTO folders (id, account_id, name, delimiter) VALUES (?, ?, ?, ?)"
        )
        .bind(&folder_id)
        .bind(&account_id)
        .bind(&folder.name)
        .bind(&folder.delimiter)
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to save folder: {}", e))?;
    }

    let folders = imap_folders.into_iter().map(|f| Folder {
        id: format!("{}-{}", account_id, f.name),
        account_id,
        name: f.name,
        delimiter: Some(f.delimiter),
    }).collect();

    Ok(folders)
}

#[command]
pub async fn fetch_emails_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, folder_name: String, limit: Option<u32>) -> Result<Vec<Email>, String> {
    // Get account with credentials
    let config = get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;

    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    let imap_emails = client.fetch_emails(&folder_name, limit.unwrap_or(50))
        .map_err(|e| format!("Failed to fetch emails: {}", e))?;

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Save emails to database
    for email in &imap_emails {
        let email_id = format!("{}-{}-{}", account_id, folder_name, email.uid);
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO emails (id, account_id, folder_id, uid, message_id, subject, from_addr, to_addr, 
                                          date, is_read, is_starred, has_attachments, preview)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&email_id)
        .bind(&account_id)
        .bind(&folder_name)
        .bind(email.uid as i64)
        .bind(&email.id)
        .bind(&email.subject)
        .bind(&email.from)
        .bind(&email.to.join(","))
        .bind(&email.date)
        .bind(email.read)
        .bind(email.starred)
        .bind(email.has_attachments)
        .bind(&email.body.chars().take(100).collect::<String>())
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to save email: {}", e))?;
    }

    let emails = imap_emails.into_iter().map(|e| Email {
        id: format!("{}-{}-{}", account_id, folder_name, e.uid),
        account_id,
        folder_id: folder_name,
        uid: e.uid as i64,
        message_id: Some(e.id),
        subject: Some(e.subject),
        from_addr: Some(e.from),
        to_addr: Some(e.to.join(",")),
        date: Some(e.date),
        is_read: e.read,
        is_starred: e.starred,
        has_attachments: e.has_attachments,
        preview: Some(e.body.chars().take(100).collect::<String>()),
    }).collect();

    Ok(emails)
}

#[command]
pub async fn send_email_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, message: EmailMessage) -> Result<(), String> {
    // Get account with credentials
    let config = get_account_with_credentials(db, app_handle, account_id).await?;

    let client = SmtpClient::new(config.smtp_config);
    client.send_email(message)
        .map_err(|e| format!("Failed to send email: {}", e))?;

    Ok(())
}

#[command]
pub async fn test_imap_connection_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String) -> Result<String, String> {
    // Get account with credentials
    let config = get_account_with_credentials(db, app_handle, account_id).await?;

    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Connection test failed: {}", e))?;
    
    client.disconnect()
        .map_err(|e| format!("Failed to disconnect after test: {}", e))?;
    
    Ok("IMAP connection test successful".to_string())
}

#[command]
pub async fn test_smtp_connection_secure(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String) -> Result<String, String> {
    // Get account with credentials
    let config = get_account_with_credentials(db, app_handle, account_id).await?;

    let client = SmtpClient::new(config.smtp_config);
    
    // Try to create a test message to verify connection
    let test_message = EmailMessage {
        to: vec![config.smtp_config.from.clone()],
        cc: vec![],
        bcc: vec![],
        subject: "Connection Test".to_string(),
        body_text: "This is a connection test message.".to_string(),
        body_html: None,
        attachments: vec![],
    };

    // Note: This would actually send a test email. For real implementation,
    // we might want to just test the connection without sending.
    client.send_email(test_message)
        .map_err(|e| format!("SMTP connection test failed: {}", e))?;

    Ok("SMTP connection test successful".to_string())
}
