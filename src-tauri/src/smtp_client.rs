use lettre::{Message, SmtpTransport, Transport, transport::smtp::authentication::Credentials};
use serde::{Deserialize, Serialize};
use std::error::Error;

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
    pub to: String,
    pub subject: String,
    pub body: String,
}

pub struct SmtpClient {
    config: SmtpConfig,
}

impl SmtpClient {
    pub fn new(config: SmtpConfig) -> Self {
        Self { config }
    }

    pub fn send_email(&self, message: EmailMessage) -> Result<(), Box<dyn Error>> {
        let email = Message::builder()
            .from(self.config.from.parse()?)
            .to(message.to.parse()?)
            .subject(&message.subject)
            .body(message.body)?;

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
}
