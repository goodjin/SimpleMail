use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Folder {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub delimiter: Option<String>,
}
