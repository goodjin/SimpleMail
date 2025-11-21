use crate::imap_client::{ImapClient, ImapConfig, ImapEmail, ImapFolder};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, LazyLock};
use std::collections::HashMap;

// Store IMAP clients in a global map
pub type ImapClients = Mutex<HashMap<String, ImapClient>>;
pub static IMAP_CLIENTS: LazyLock<ImapClients> = LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub account_id: String,
    pub imap_config: ImapConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchEmailsRequest {
    pub account_id: String,
    pub folder: String,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MarkEmailRequest {
    pub account_id: String,
    pub folder: String,
    pub uid: u32,
    pub action: String, // "read", "unread", "starred", "unstarred", "delete"
}

#[tauri::command]
pub async fn imap_connect(request: ConnectRequest) -> Result<(), String> {
    let mut clients = IMAP_CLIENTS.lock().unwrap();
    let mut client = ImapClient::new(request.imap_config);
    client.connect()
        .map_err(|e| format!("Failed to connect: {}", e))?;
    clients.insert(request.account_id, client);
    Ok(())
}

#[tauri::command]
pub fn imap_disconnect(account_id: String) -> Result<String, String> {
    let mut connections = IMAP_CLIENTS.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    
    if let Some(mut client) = connections.remove(&account_id) {
        client.disconnect()
            .map_err(|e| format!("Failed to disconnect: {}", e))?;
    }
    
    Ok("Disconnected successfully".to_string())
}

#[tauri::command]
pub async fn imap_list_folders(account_id: String) -> Result<Vec<ImapFolder>, String> {
    let mut clients = IMAP_CLIENTS.lock().unwrap();
    
    let client = clients.get_mut(&account_id)
        .ok_or("No connection found for account")?;
    
    client.list_folders()
}

#[tauri::command]
pub fn imap_fetch_emails(request: FetchEmailsRequest) -> Result<Vec<ImapEmail>, String> {
    let mut connections = IMAP_CLIENTS.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    
    let client = connections.get_mut(&request.account_id)
        .ok_or("No connection found for account")?;
    
    let limit = request.limit.unwrap_or(50);
    client.fetch_emails(&request.folder, limit)
}

#[tauri::command]
pub fn imap_mark_email(request: MarkEmailRequest) -> Result<(), String> {
    let mut connections = IMAP_CLIENTS.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    
    let client = connections.get_mut(&request.account_id)
        .ok_or("No connection found for account")?;
    
    match request.action.as_str() {
        "read" => client.mark_as_read(&request.folder, request.uid),
        "starred" => client.mark_as_starred(&request.folder, request.uid),
        "delete" => client.delete_email(&request.folder, request.uid),
        _ => Err(format!("Unknown action: {}", request.action)),
    }
}

#[tauri::command]
pub fn imap_test_connection(imap_config: ImapConfig) -> Result<String, String> {
    let mut client = ImapClient::new(imap_config);
    
    client.connect()
        .map_err(|e| format!("Connection test failed: {}", e))?;
    
    client.disconnect()
        .map_err(|e| format!("Failed to disconnect after test: {}", e))?;
    
    Ok("Connection test successful".to_string())
}
