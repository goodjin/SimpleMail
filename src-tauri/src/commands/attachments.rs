use crate::db::Database;
use crate::models::{Email, MailAttachment};
use crate::smtp_client::{SmtpClient, SmtpConfig, EmailMessage};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::command;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentUpload {
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub content: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentPreview {
    pub id: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub preview_url: Option<String>,
    pub is_image: bool,
    pub is_pdf: bool,
    pub is_text: bool,
}

#[command]
pub async fn upload_attachment(db: tauri::State<'_, Database>, email_id: String, attachment: AttachmentUpload) -> Result<String, String> {
    // Generate unique attachment ID
    let attachment_id = format!("{}-{}", email_id, uuid::Uuid::new_v4());
    
    // Save attachment to database
    sqlx::query(
        "INSERT INTO attachments (id, email_id, filename, content_type, size, content) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&attachment_id)
    .bind(&email_id)
    .bind(&attachment.filename)
    .bind(&attachment.content_type)
    .bind(attachment.size as i64)
    .bind(&attachment.content)
    .execute(&db.pool)
    .await
    .map_err(|e| format!("Failed to save attachment to database: {}", e))?;

    // Update email to indicate it has attachments
    sqlx::query("UPDATE emails SET has_attachments = 1 WHERE id = ?")
        .bind(&email_id)
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to update email attachment flag: {}", e))?;

    Ok(attachment_id)
}

#[command]
pub async fn upload_multiple_attachments(db: tauri::State<'_, Database>, email_id: String, attachments: Vec<AttachmentUpload>) -> Result<Vec<String>, String> {
    let mut attachment_ids = Vec::new();
    
    // Start transaction for multiple uploads
    let mut tx = db.pool.begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    for attachment in attachments {
        let attachment_id = format!("{}-{}", email_id, uuid::Uuid::new_v4());
        
        // Save attachment to database
        sqlx::query(
            "INSERT INTO attachments (id, email_id, filename, content_type, size, content) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&attachment_id)
        .bind(&email_id)
        .bind(&attachment.filename)
        .bind(&attachment.content_type)
        .bind(attachment.size as i64)
        .bind(&attachment.content)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to save attachment to database: {}", e))?;

        attachment_ids.push(attachment_id);
    }

    // Update email to indicate it has attachments
    if !attachment_ids.is_empty() {
        sqlx::query("UPDATE emails SET has_attachments = 1 WHERE id = ?")
            .bind(&email_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to update email attachment flag: {}", e))?;
    }

    // Commit transaction
    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(attachment_ids)
}

#[command]
pub async fn get_email_attachments(db: tauri::State<'_, Database>, email_id: String) -> Result<Vec<MailAttachment>, String> {
    let attachments = sqlx::query_as!(
        MailAttachment,
        "SELECT id, filename, content_type, size, content FROM attachments WHERE email_id = ? ORDER BY filename",
        email_id
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| format!("Failed to get attachments: {}", e))?;

    Ok(attachments)
}

#[command]
pub async fn download_attachment(db: tauri::State<'_, Database>, attachment_id: String) -> Result<Vec<u8>, String> {
    let attachment = sqlx::query!(
        "SELECT content FROM attachments WHERE id = ?",
        attachment_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to get attachment: {}", e))?;

    Ok(attachment.content)
}

#[command]
pub async fn delete_attachment(db: tauri::State<'_, Database>, attachment_id: String) -> Result<(), String> {
    // Get email_id before deleting
    let email_id = sqlx::query!(
        "SELECT email_id FROM attachments WHERE id = ?",
        attachment_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to get attachment email_id: {}", e))?
    .email_id;

    // Delete attachment
    sqlx::query("DELETE FROM attachments WHERE id = ?")
        .bind(&attachment_id)
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to delete attachment: {}", e))?;

    // Check if email still has attachments
    let remaining_count = sqlx::query_scalar!(
        "SELECT COUNT(*) as count FROM attachments WHERE email_id = ?",
        email_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to check remaining attachments: {}", e))?
    .unwrap_or(0);

    // Update email attachment flag
    if remaining_count == 0 {
        sqlx::query("UPDATE emails SET has_attachments = 0 WHERE id = ?")
            .bind(&email_id)
            .execute(&db.pool)
            .await
            .map_err(|e| format!("Failed to update email attachment flag: {}", e))?;
    }

    Ok(())
}

#[command]
pub async fn get_attachment_preview(db: tauri::State<'_, Database>, attachment_id: String) -> Result<AttachmentPreview, String> {
    let attachment = sqlx::query!(
        "SELECT id, filename, content_type, size FROM attachments WHERE id = ?",
        attachment_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to get attachment: {}", e))?;

    let content_type = attachment.content_type.to_lowercase();
    let filename = attachment.filename.to_lowercase();
    
    let is_image = content_type.starts_with("image/") || 
                   filename.ends_with(".jpg") || 
                   filename.ends_with(".jpeg") || 
                   filename.ends_with(".png") || 
                   filename.ends_with(".gif") || 
                   filename.ends_with(".webp");
    
    let is_pdf = content_type == "application/pdf" || filename.ends_with(".pdf");
    let is_text = content_type.starts_with("text/") || 
                  filename.ends_with(".txt") || 
                  filename.ends_with(".md") || 
                  filename.ends_with(".json") || 
                  filename.ends_with(".xml") || 
                  filename.ends_with(".csv");

    let preview_url = if is_image {
        Some(format!("attachment://preview/{}", attachment_id))
    } else if is_text {
        Some(format!("attachment://text/{}", attachment_id))
    } else {
        None
    };

    Ok(AttachmentPreview {
        id: attachment.id,
        filename: attachment.filename,
        content_type: attachment.content_type,
        size: attachment.size as u64,
        preview_url,
        is_image,
        is_pdf,
        is_text,
    })
}

#[command]
pub async fn get_text_attachment_content(db: tauri::State<'_, Database>, attachment_id: String) -> Result<String, String> {
    let attachment = sqlx::query!(
        "SELECT content, content_type FROM attachments WHERE id = ?",
        attachment_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to get attachment: {}", e))?;

    // Try to decode as UTF-8 text
    let content = String::from_utf8(attachment.content)
        .map_err(|_| "Attachment is not valid UTF-8 text".to_string())?;

    // Limit content size for preview
    let max_preview_size = 100_000; // 100KB
    if content.len() > max_preview_size {
        let truncated = &content[..max_preview_size];
        Ok(format!("{}\n\n... (content truncated, {} bytes total)", truncated, content.len()))
    } else {
        Ok(content)
    }
}

#[command]
pub async fn save_attachment_to_file(db: tauri::State<'_, Database>, attachment_id: String, file_path: String) -> Result<(), String> {
    let attachment = sqlx::query!(
        "SELECT filename, content FROM attachments WHERE id = ?",
        attachment_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to get attachment: {}", e))?;

    // Create directory if it doesn't exist
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Write file
    fs::write(&file_path, attachment.content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[command]
pub async fn get_attachment_stats(db: tauri::State<'_, Database>, email_id: String) -> Result<AttachmentStats, String> {
    let stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as total_attachments,
            SUM(size) as total_size,
            COUNT(CASE WHEN content_type LIKE 'image/%' THEN 1 END) as image_count,
            COUNT(CASE WHEN content_type = 'application/pdf' THEN 1 END) as pdf_count,
            COUNT(CASE WHEN content_type LIKE 'text/%' THEN 1 END) as text_count
        FROM attachments 
        WHERE email_id = ?
        "#,
        email_id
    )
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to get attachment stats: {}", e))?;

    Ok(AttachmentStats {
        total_attachments: stats.total_attachments as u32,
        total_size: stats.total_size.unwrap_or(0) as u64,
        image_count: stats.image_count as u32,
        pdf_count: stats.pdf_count as u32,
        text_count: stats.text_count as u32,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentStats {
    pub total_attachments: u32,
    pub total_size: u64,
    pub image_count: u32,
    pub pdf_count: u32,
    pub text_count: u32,
}
