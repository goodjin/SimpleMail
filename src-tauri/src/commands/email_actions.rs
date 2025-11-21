use crate::db::Database;
use crate::models::{Email, MailAttachment};
use crate::imap_client::{ImapClient, ImapConfig};
use crate::smtp_client::{SmtpClient, SmtpConfig, EmailMessage};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailAction {
    pub email_ids: Vec<String>,
    pub action: EmailActionType,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum EmailActionType {
    MarkAsRead,
    MarkAsUnread,
    Star,
    Unstar,
    Delete,
    Move { target_folder: String },
}

#[command]
pub async fn mark_emails_as_read(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, email_ids: Vec<String>) -> Result<(), String> {
    if email_ids.is_empty() {
        return Ok(());
    }

    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Mark emails as read on server
    for email_id in &email_ids {
        // Extract folder and UID from email_id (format: "account-folder-uid")
        let parts: Vec<&str> = email_id.split('-').collect();
        if parts.len() >= 3 {
            let folder = parts[1];
            if let Some(uid_str) = parts.last() {
                if let Ok(uid) = uid_str.parse::<u32>() {
                    client.mark_as_read(folder, uid)
                        .map_err(|e| format!("Failed to mark email {} as read on server: {}", email_id, e))?;
                }
            }
        }
    }

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Update emails in database
    let placeholders = email_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("UPDATE emails SET is_read = 1 WHERE id IN ({})", placeholders);
    
    let mut query_builder = sqlx::query(&query);
    for email_id in &email_ids {
        query_builder = query_builder.bind(email_id);
    }
    
    query_builder.execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to update emails in database: {}", e))?;

    Ok(())
}

#[command]
pub async fn mark_emails_as_unread(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, email_ids: Vec<String>) -> Result<(), String> {
    if email_ids.is_empty() {
        return Ok(());
    }

    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Mark emails as unread on server
    for email_id in &email_ids {
        // Extract folder and UID from email_id
        let parts: Vec<&str> = email_id.split('-').collect();
        if parts.len() >= 3 {
            let folder = parts[1];
            if let Some(uid_str) = parts.last() {
                if let Ok(uid) = uid_str.parse::<u32>() {
                    client.mark_as_unread(folder, uid)
                        .map_err(|e| format!("Failed to mark email {} as unread on server: {}", email_id, e))?;
                }
            }
        }
    }

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Update emails in database
    let placeholders = email_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("UPDATE emails SET is_read = 0 WHERE id IN ({})", placeholders);
    
    let mut query_builder = sqlx::query(&query);
    for email_id in &email_ids {
        query_builder = query_builder.bind(email_id);
    }
    
    query_builder.execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to update emails in database: {}", e))?;

    Ok(())
}

#[command]
pub async fn star_emails(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, email_ids: Vec<String>) -> Result<(), String> {
    if email_ids.is_empty() {
        return Ok(());
    }

    // Update emails in database (starring is typically a local operation)
    let placeholders = email_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("UPDATE emails SET is_starred = 1 WHERE id IN ({})", placeholders);
    
    let mut query_builder = sqlx::query(&query);
    for email_id in &email_ids {
        query_builder = query_builder.bind(email_id);
    }
    
    query_builder.execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to star emails in database: {}", e))?;

    Ok(())
}

#[command]
pub async fn unstar_emails(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, email_ids: Vec<String>) -> Result<(), String> {
    if email_ids.is_empty() {
        return Ok(());
    }

    // Update emails in database
    let placeholders = email_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("UPDATE emails SET is_starred = 0 WHERE id IN ({})", placeholders);
    
    let mut query_builder = sqlx::query(&query);
    for email_id in &email_ids {
        query_builder = query_builder.bind(email_id);
    }
    
    query_builder.execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to unstar emails in database: {}", e))?;

    Ok(())
}

#[command]
pub async fn delete_emails(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, email_ids: Vec<String>) -> Result<(), String> {
    if email_ids.is_empty() {
        return Ok(());
    }

    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Delete emails on server
    for email_id in &email_ids {
        // Extract folder and UID from email_id
        let parts: Vec<&str> = email_id.split('-').collect();
        if parts.len() >= 3 {
            let folder = parts[1];
            if let Some(uid_str) = parts.last() {
                if let Ok(uid) = uid_str.parse::<u32>() {
                    client.delete_email(folder, uid)
                        .map_err(|e| format!("Failed to delete email {} on server: {}", email_id, e))?;
                }
            }
        }
    }

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Delete emails from database
    let placeholders = email_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("DELETE FROM emails WHERE id IN ({})", placeholders);
    
    let mut query_builder = sqlx::query(&query);
    for email_id in &email_ids {
        query_builder = query_builder.bind(email_id);
    }
    
    query_builder.execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to delete emails from database: {}", e))?;

    Ok(())
}

#[command]
pub async fn bulk_move_emails(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, source_folder: String, target_folder: String, email_ids: Vec<String>) -> Result<(), String> {
    // Use the existing move_emails_to_folder function
    crate::commands::folder_ops::move_emails_to_folder(db, app_handle, account_id, source_folder, target_folder, email_ids).await
}

#[command]
pub async fn bulk_mark_emails(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, email_ids: Vec<String>, mark_as_read: bool) -> Result<(), String> {
    if mark_as_read {
        mark_emails_as_read(db, app_handle, account_id, email_ids).await
    } else {
        mark_emails_as_unread(db, app_handle, account_id, email_ids).await
    }
}

#[command]
pub async fn bulk_star_emails(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, email_ids: Vec<String>, star: bool) -> Result<(), String> {
    if star {
        star_emails(db, app_handle, account_id, email_ids).await
    } else {
        unstar_emails(db, app_handle, account_id, email_ids).await
    }
}

#[command]
pub async fn get_email_actions_summary(db: tauri::State<'_, Database>, account_id: String, folder_name: String) -> Result<EmailActionsSummary, String> {
    let folder_id = format!("{}-{}", account_id, folder_name);
    
    let summary = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as total_emails,
            COUNT(CASE WHEN NOT is_read THEN 1 END) as unread_emails,
            COUNT(CASE WHEN is_starred THEN 1 END) as starred_emails,
            COUNT(CASE WHEN has_attachments THEN 1 END) as emails_with_attachments
        FROM emails 
        WHERE folder_id = ?
        "#,
        folder_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to get email actions summary: {}", e))?;

    Ok(EmailActionsSummary {
        total_emails: summary.total_emails as u32,
        unread_emails: summary.unread_emails as u32,
        starred_emails: summary.starred_emails as u32,
        emails_with_attachments: summary.emails_with_attachments as u32,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailActionsSummary {
    pub total_emails: u32,
    pub unread_emails: u32,
    pub starred_emails: u32,
    pub emails_with_attachments: u32,
}
