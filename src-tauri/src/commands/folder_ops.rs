use crate::db::Database;
use crate::models::{Email, Folder};
use crate::imap_client::{ImapClient, ImapConfig};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderOperation {
    pub account_id: String;
    pub folder_name: String;
    pub operation: FolderAction,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum FolderAction {
    Create,
    Rename { new_name: String },
    Delete,
    Move { target_folder: String },
}

#[command]
pub async fn create_folder(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, folder_name: String) -> Result<String, String> {
    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Create folder on server
    client.create_folder(&folder_name)
        .map_err(|e| format!("Failed to create folder on server: {}", e))?;

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Save folder to database
    let folder_id = format!("{}-{}", account_id, folder_name);
    sqlx::query(
        "INSERT INTO folders (id, account_id, name, delimiter) VALUES (?, ?, ?, ?)"
    )
    .bind(&folder_id)
    .bind(&account_id)
    .bind(&folder_name)
    .bind(".")
    .execute(&db.pool)
    .await
    .map_err(|e| format!("Failed to save folder to database: {}", e))?;

    Ok(folder_id)
}

#[command]
pub async fn rename_folder(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, folder_name: String, new_name: String) -> Result<(), String> {
    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Rename folder on server
    client.rename_folder(&folder_name, &new_name)
        .map_err(|e| format!("Failed to rename folder on server: {}", e))?;

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Update folder in database
    let old_folder_id = format!("{}-{}", account_id, folder_name);
    let new_folder_id = format!("{}-{}", account_id, new_name);
    
    // Start transaction for folder rename
    let mut tx = db.pool.begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Update folder
    sqlx::query("UPDATE folders SET id = ?, name = ? WHERE id = ?")
        .bind(&new_folder_id)
        .bind(&new_name)
        .bind(&old_folder_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to update folder: {}", e))?;

    // Update emails in this folder
    sqlx::query("UPDATE emails SET folder_id = ? WHERE folder_id = ?")
        .bind(&new_folder_id)
        .bind(&old_folder_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to update emails: {}", e))?;

    // Commit transaction
    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}

#[command]
pub async fn delete_folder(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, folder_name: String) -> Result<(), String> {
    // Prevent deletion of essential folders
    let lower_name = folder_name.to_lowercase();
    if lower_name.contains("inbox") || lower_name.contains("sent") || lower_name.contains("trash") || lower_name.contains("drafts") {
        return Err("Cannot delete essential system folders".to_string());
    }

    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Delete folder on server
    client.delete_folder(&folder_name)
        .map_err(|e| format!("Failed to delete folder on server: {}", e))?;

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Delete folder and emails from database
    let folder_id = format!("{}-{}", account_id, folder_name);
    
    // Start transaction for folder deletion
    let mut tx = db.pool.begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Delete emails in this folder
    sqlx::query("DELETE FROM emails WHERE folder_id = ?")
        .bind(&folder_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete emails: {}", e))?;

    // Delete folder
    sqlx::query("DELETE FROM folders WHERE id = ?")
        .bind(&folder_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete folder: {}", e))?;

    // Commit transaction
    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}

#[command]
pub async fn move_emails_to_folder(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, source_folder: String, target_folder: String, email_ids: Vec<String>) -> Result<(), String> {
    if email_ids.is_empty() {
        return Ok(());
    }

    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Move emails on server
    for email_id in &email_ids {
        // Extract UID from email_id (format: "account-folder-uid")
        if let Some(uid_str) = email_id.split('-').last() {
            if let Ok(uid) = uid_str.parse::<u32>() {
                client.move_email(&source_folder, uid, &target_folder)
                    .map_err(|e| format!("Failed to move email {} on server: {}", email_id, e))?;
            }
        }
    }

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Update emails in database
    let target_folder_id = format!("{}-{}", account_id, target_folder);
    
    let placeholders = email_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("UPDATE emails SET folder_id = ? WHERE id IN ({})", placeholders);
    
    let mut query_builder = sqlx::query(&query).bind(&target_folder_id);
    for email_id in &email_ids {
        query_builder = query_builder.bind(email_id);
    }
    
    query_builder.execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to update emails in database: {}", e))?;

    Ok(())
}

#[command]
pub async fn empty_folder(db: tauri::State<'_, Database>, app_handle: tauri::AppHandle, account_id: String, folder_name: String) -> Result<(), String> {
    // Get account with credentials
    let config = crate::commands::email_secure::get_account_with_credentials(db, app_handle.clone(), account_id.clone()).await?;
    
    let mut client = ImapClient::new(config.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect to IMAP: {}", e))?;

    // Get all emails in folder
    let emails = client.fetch_emails(&folder_name, Some(10000))
        .map_err(|e| format!("Failed to fetch emails: {}", e))?;

    // Delete all emails from folder
    for email in &emails {
        client.delete_email(&folder_name, email.uid)
            .map_err(|e| format!("Failed to delete email on server: {}", e))?;
    }

    client.disconnect()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    // Delete emails from database
    let folder_id = format!("{}-{}", account_id, folder_name);
    
    sqlx::query("DELETE FROM emails WHERE folder_id = ?")
        .bind(&folder_id)
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to delete emails from database: {}", e))?;

    Ok(())
}

#[command]
pub async fn get_folder_stats(db: tauri::State<'_, Database>, account_id: String, folder_name: String) -> Result<FolderStats, String> {
    let folder_id = format!("{}-{}", account_id, folder_name);
    
    let stats = sqlx::query!(
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
    .map_err(|e| format!("Failed to get folder stats: {}", e))?;

    Ok(FolderStats {
        total_emails: stats.total_emails as u32,
        unread_emails: stats.unread_emails as u32,
        starred_emails: stats.starred_emails as u32,
        emails_with_attachments: stats.emails_with_attachments as u32,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderStats {
    pub total_emails: u32,
    pub unread_emails: u32,
    pub starred_emails: u32,
    pub emails_with_attachments: u32,
}
