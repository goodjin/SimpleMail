// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Mutex;

// Import commands
mod imap_client;
mod imap_commands;
mod smtp_client;
mod smtp_commands;
mod fs_commands;

type SmtpClients = Mutex<HashMap<String, smtp_client::SmtpClient>>;

fn main() {
    // Initialize SMTP clients map
    let smtp_clients: SmtpClients = std::sync::Mutex::new(std::collections::HashMap::new());
    
    tauri::Builder::default()
        .manage(smtp_clients)
        .invoke_handler(tauri::generate_handler![
            fs_commands::read_text_file,
            fs_commands::write_text_file,
            fs_commands::save_attachment,
            // IMAP commands
            imap_commands::imap_connect,
            imap_commands::imap_disconnect,
            imap_commands::imap_list_folders,
            imap_commands::imap_fetch_emails,
            imap_commands::imap_mark_email,
            imap_commands::imap_test_connection,
            // SMTP commands
            smtp_commands::smtp_connect,
            smtp_commands::smtp_disconnect,
            smtp_commands::smtp_send_email,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
