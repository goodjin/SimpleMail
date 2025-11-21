use lettre::{Message, SmtpTransport, Transport, transport::smtp::authentication::Credentials};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailMessage {
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub bcc: Vec<String>,
    pub subject: String,
    pub body_text: String,
    pub body_html: Option<String>,
    pub attachments: Vec<EmailAttachment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailAttachment {
    pub filename: String,
    pub content: Vec<u8>,
    pub mime_type: String,
}

pub struct SmtpClient {
    config: SmtpConfig,
}

impl SmtpClient {
    pub fn new(config: SmtpConfig) -> Self {
        Self { config }
    }

    pub fn send_email(&self, message: EmailMessage) -> Result<(), Box<dyn Error>> {
        let mut email_builder = Message::builder()
            .from(self.config.from.parse()?);

        // Add recipients
        for to_addr in &message.to {
            email_builder = email_builder.to(to_addr.parse()?);
        }
        for cc_addr in &message.cc {
            email_builder = email_builder.cc(cc_addr.parse()?);
        }
        for bcc_addr in &message.bcc {
            email_builder = email_builder.bcc(bcc_addr.parse()?);
        }

        // Build multipart email if needed
        let email_body = if message.body_html.is_some() || !message.attachments.is_empty() {
            // Use mail-builder for complex emails
            self.build_multipart_email(&message)?
        } else {
            // Simple text email
            message.body_text
        };

        let email = email_builder
            .subject(&message.subject)
            .body(email_body)?;

        let transport = SmtpTransport::relay(&self.config.host)?
            .port(self.config.port)
            .credentials(Credentials::new(
                self.config.username.clone(),
                self.config.password.clone(),
            ))
            .build();

        transport.send(&email)?;
        Ok(())
    }

    fn build_multipart_email(&self, message: &EmailMessage) -> Result<String, Box<dyn Error>> {
        use mail_builder::{MessageBuilder, headers::address::Address, mime::Mime};
        
        let mut builder = MessageBuilder::new();
        builder = builder.from(Address::new_address(&self.config.from));
        
        for to_addr in &message.to {
            builder = builder.to(Address::new_address(to_addr));
        }
        for cc_addr in &message.cc {
            builder = builder.cc(Address::new_address(cc_addr));
        }
        for bcc_addr in &message.bcc {
            builder = builder.bcc(Address::new_address(bcc_addr));
        }
        
        builder = builder.subject(&message.subject);

        // Add text part
        builder = builder.text_body(&message.body_text);

        // Add HTML part if present
        if let Some(html_body) = &message.body_html {
            builder = builder.html_body(html_body);
        }

        // Add attachments
        for attachment in &message.attachments {
            builder = builder.attachment(
                &attachment.filename,
                &attachment.content,
                &Mime::from_str(&attachment.mime_type).unwrap_or(Mime::TEXT_PLAIN),
            );
        }

        let email = builder.write_to_vec()?;
        Ok(String::from_utf8(email)?)
    }
}
