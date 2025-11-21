use imap::{Client, Session};
use mailparse::MailHeaderMap;
use std::net::TcpStream;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub tls: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImapEmail {
    pub id: String,
    pub uid: u32,
    pub from: String,
    pub to: Vec<String>,
    pub subject: String,
    pub body: String,
    pub date: String,
    pub read: bool,
    pub starred: bool,
    pub has_attachments: bool,
    pub folder: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImapFolder {
    pub name: String,
    pub delimiter: String,
    pub flags: Vec<String>,
    pub message_count: Option<u32>,
}

pub struct ImapClient {
    config: ImapConfig,
    session: Option<Session<native_tls::TlsStream<std::net::TcpStream>>>,
}

impl ImapClient {
    pub fn new(config: ImapConfig) -> Self {
        Self {
            config,
            session: None,
        }
    }

    pub fn connect(&mut self) -> Result<(), String> {
        let imap_addr = format!("{}:{}", self.config.host, self.config.port);
        
        // Create TCP connection
        let stream = TcpStream::connect(&imap_addr)
            .map_err(|e| format!("Failed to connect to {}: {}", imap_addr, e))?;
        
        // Create TLS connection
        let tls_stream = native_tls::TlsConnector::builder()
            .build()
            .map_err(|e| format!("Failed to create TLS connector: {}", e))?
            .connect(&self.config.host, stream)
            .map_err(|e| format!("TLS handshake failed: {}", e))?;
        
        // Create IMAP client
        let client = Client::new(tls_stream);
        let mut session = client.login(&self.config.username, &self.config.password)
            .map_err(|e| format!("Login failed: {:?}", e))?;

        // Test connection
        session.capabilities()
            .map_err(|e| format!("Failed to get capabilities: {}", e))?;

        self.session = Some(session);
        Ok(())
    }

    pub fn disconnect(&mut self) -> Result<(), String> {
        if let Some(mut session) = self.session.take() {
            session.logout()
                .map_err(|e| format!("Failed to logout: {}", e))?;
        }
        Ok(())
    }

    pub fn list_folders(&mut self) -> Result<Vec<ImapFolder>, String> {
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        let folders = session.list(None, Some("*"))
            .map_err(|e| format!("Failed to list folders: {}", e))?;

        let mut result = Vec::new();
        for folder in folders.iter() {
            let folder_name = folder.name();
                result.push(ImapFolder {
                    name: folder_name.to_string(),
                    delimiter: folder.delimiter().unwrap_or("/").to_string(),
                    flags: vec![], // TODO: Parse folder flags
                    message_count: None,
                });
        }

        Ok(result)
    }

    pub fn select_folder(&mut self, folder: &str) -> Result<u32, String> {
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        let mailbox = session.select(folder)
            .map_err(|e| format!("Failed to select folder '{}': {}", folder, e))?;
        Ok(mailbox.exists)
    }

    pub fn fetch_emails(&mut self, folder: &str, limit: u32) -> Result<Vec<ImapEmail>, String> {
        let message_count = self.select_folder(folder)?;
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        // Fetch latest emails
        let start_seq = if message_count > limit {
            message_count - limit + 1
        } else {
            1
        };

        let messages = session.fetch(format!("{}:{}", start_seq, message_count), "(UID RFC822 FLAGS)")
            .map_err(|e| format!("Failed to fetch emails: {}", e))?;

        let mut emails = Vec::new();
        for msg in messages.iter().rev() {
            if let Some(uid) = msg.uid {
                if let Some(body) = msg.body() {
                    let email = self.parse_email(uid, body, folder)?;
                    emails.push(email);
                }
            }
        }

        Ok(emails)
    }

    fn parse_email(&self, uid: u32, raw_body: &[u8], folder: &str) -> Result<ImapEmail, String> {
        let parsed = mailparse::parse_mail(raw_body)
            .map_err(|e| format!("Failed to parse email: {}", e))?;

        let from = parsed.headers.get_first_value("From")
            .unwrap_or_else(|| "Unknown".to_string());

        let to = parsed.headers.get_all_values("To");
        let to = if to.is_empty() {
            vec!["Unknown".to_string()]
        } else {
            to
        };

        let subject = parsed.headers.get_first_value("Subject")
            .unwrap_or_else(|| "No Subject".to_string());

        let date = parsed.headers.get_first_value("Date")
            .unwrap_or_else(|| "".to_string());

        let body = parsed.get_body()
            .unwrap_or_else(|_| "Failed to parse body".to_string());

        let read = true; // Default to read since we can't access flags
        let starred = false;
        let has_attachments = parsed.subparts.len() > 1; // Simple attachment detection

        Ok(ImapEmail {
            id: format!("{}-{}", folder, uid),
            uid,
            from,
            to,
            subject,
            body,
            date,
            read,
            starred,
            has_attachments,
            folder: folder.to_string(),
        })
    }

    pub fn mark_as_read(&mut self, folder: &str, uid: u32) -> Result<(), String> {
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        session.select(folder)
            .map_err(|e| format!("Failed to select folder: {}", e))?;

        session.store(format!("{}", uid), "+FLAGS (\\Seen)")
            .map_err(|e| format!("Failed to mark as read: {}", e))?;

        Ok(())
    }

    pub fn mark_as_starred(&mut self, folder: &str, uid: u32) -> Result<(), String> {
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        session.select(folder)
            .map_err(|e| format!("Failed to select folder: {}", e))?;

        session.store(format!("{}", uid), "+FLAGS (\\Flagged)")
            .map_err(|e| format!("Failed to mark as starred: {}", e))?;

        Ok(())
    }

    pub fn delete_email(&mut self, folder: &str, uid: u32) -> Result<(), String> {
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        session.select(folder)
            .map_err(|e| format!("Failed to select folder: {}", e))?;

        // Mark for deletion
        session.store(format!("{}", uid), "+FLAGS (\\Deleted)")
            .map_err(|e| format!("Failed to mark for deletion: {}", e))?;

        // Expunge to actually delete
        session.expunge()
            .map_err(|e| format!("Failed to expunge deleted emails: {}", e))?;

        Ok(())
    }

    pub fn mark_as_unread(&mut self, folder: &str, uid: u32) -> Result<(), String> {
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        session.select(folder)
            .map_err(|e| format!("Failed to select folder: {}", e))?;

        session.store(format!("{}", uid), "-FLAGS (\\Seen)")
            .map_err(|e| format!("Failed to mark as unread: {}", e))?;

        Ok(())
    }

    pub fn move_email(&mut self, folder: &str, uid: u32, dest_folder: &str) -> Result<(), String> {
        let session = self.session.as_mut()
            .ok_or("Not connected to IMAP server")?;

        session.select(folder)
            .map_err(|e| format!("Failed to select folder: {}", e))?;

        // Copy email to destination folder
        session.copy(format!("{}", uid), dest_folder)
            .map_err(|e| format!("Failed to copy email: {}", e))?;

        // Mark original for deletion
        session.store(format!("{}", uid), "+FLAGS (\\Deleted)")
            .map_err(|e| format!("Failed to mark for deletion: {}", e))?;

        // Expunge to actually delete
        session.expunge()
            .map_err(|e| format!("Failed to expunge deleted emails: {}", e))?;

        Ok(())
    }
}
