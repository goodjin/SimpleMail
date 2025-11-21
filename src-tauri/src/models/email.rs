use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Email {
    pub id: String,
    pub account_id: String,
    pub folder_id: String,
    pub uid: i64,
    pub message_id: Option<String>,
    pub subject: Option<String>,
    pub from_addr: Option<String>,
    pub to_addr: Option<String>,
    pub date: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub has_attachments: bool,
    pub preview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct EmailDetail {
    #[sqlx(flatten)]
    pub header: Email,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
}
