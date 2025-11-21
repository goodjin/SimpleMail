use crate::email::parser::{self, ParsedEmail};
use tauri::command;

#[command]
pub fn parse_email_content(content: Vec<u8>) -> Result<ParsedEmail, String> {
    parser::parse_email(&content)
}
