use crate::smtp_client::{SmtpClient, SmtpConfig, EmailMessage};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::HashMap;
use std::sync::LazyLock;

pub type SmtpClients = Mutex<HashMap<String, SmtpClient>>;

static SMTP_CLIENTS: LazyLock<SmtpClients> = LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub account_id: String,
    pub smtp_config: SmtpConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendEmailParams {
    pub account_id: String,
    pub to: String,
    pub subject: String,
    pub body: String,
}

#[tauri::command]
pub async fn smtp_connect(request: ConnectRequest) -> Result<(), String> {
    let mut clients = SMTP_CLIENTS.lock().unwrap();
    let client = SmtpClient::new(request.smtp_config);
    clients.insert(request.account_id, client);
    Ok(())
}

#[tauri::command]
pub fn smtp_disconnect(account_id: String) -> Result<bool, String> {
    let mut clients = SMTP_CLIENTS.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    
    let removed = clients.remove(&account_id).is_some();
    Ok(removed)
}

#[tauri::command]
pub async fn smtp_send_email(
    params: SendEmailParams,
) -> Result<(), String> {
    let message = EmailMessage {
        to: params.to,
        subject: params.subject,
        body: params.body,
    };

    // Get the client and send
    let clients = SMTP_CLIENTS.lock().unwrap();
    let client = clients
        .get(&params.account_id)
        .ok_or_else(|| "SMTP client not found".to_string())?;

    client.send_email(message).map_err(|e| e.to_string())
}
