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
mod email;
mod commands;
mod db;
mod models;
mod credentials;
mod test_utils;

use tauri::Manager;

type SmtpClients = Mutex<HashMap<String, smtp_client::SmtpClient>>;

fn main() {
    // Initialize SMTP clients map
    let smtp_clients: SmtpClients = std::sync::Mutex::new(std::collections::HashMap::new());
    
    tauri::Builder::default()
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                let db = db::Database::init(app.handle()).await.expect("Failed to initialize database");
                app.manage(db);
            });
            Ok(())
        })
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
            imap_commands::imap_move_email,
            imap_commands::imap_test_connection,
            // SMTP commands
            smtp_commands::smtp_connect,
            smtp_commands::smtp_disconnect,
            smtp_commands::smtp_send_email,
            // Email commands
            commands::email::parse_email_content,
            commands::email_ops::save_account,
            commands::email_ops::get_accounts,
            commands::email_ops::delete_account,
            commands::email_ops::sync_folders,
            commands::email_ops::fetch_emails,
            commands::email_ops::send_email,
            commands::email_ops::test_smtp_connection,
            // Secure email commands
            commands::email_secure::save_account_secure,
            commands::email_secure::get_accounts_secure,
            commands::email_secure::delete_account_secure,
            commands::email_secure::get_account_with_credentials,
            commands::email_secure::sync_folders_secure,
            commands::email_secure::fetch_emails_secure,
            commands::email_secure::send_email_secure,
            commands::email_secure::test_imap_connection_secure,
            commands::email_secure::test_smtp_connection_secure,
            // Folder operations
            commands::folder_ops::create_folder,
            commands::folder_ops::rename_folder,
            commands::folder_ops::delete_folder,
            commands::folder_ops::move_emails_to_folder,
            commands::folder_ops::empty_folder,
            commands::folder_ops::get_folder_stats,
            // Email actions
            commands::email_actions::mark_emails_as_read,
            commands::email_actions::mark_emails_as_unread,
            commands::email_actions::star_emails,
            commands::email_actions::unstar_emails,
            commands::email_actions::delete_emails,
            commands::email_actions::bulk_move_emails,
            commands::email_actions::bulk_mark_emails,
            commands::email_actions::bulk_star_emails,
            commands::email_actions::get_email_actions_summary,
            // Attachments
            commands::attachments::upload_attachment,
            commands::attachments::upload_multiple_attachments,
            commands::attachments::get_email_attachments,
            commands::attachments::download_attachment,
            commands::attachments::delete_attachment,
            commands::attachments::get_attachment_preview,
            commands::attachments::get_text_attachment_content,
            commands::attachments::save_attachment_to_file,
            commands::attachments::get_attachment_stats,
            // Search
            commands::search::search_emails,
            commands::search::quick_search,
            commands::search::search_by_sender,
            commands::search::search_by_subject,
            commands::search::search_with_attachments,
            commands::search::search_unread_emails,
            commands::search::search_starred_emails,
            commands::search::search_by_date_range,
            commands::search::get_search_suggestions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
