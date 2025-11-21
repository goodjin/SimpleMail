use mail_parser::{Message, MimeHeaders};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailAddress {
    pub name: Option<String>,
    pub address: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailAttachment {
    pub filename: Option<String>,
    pub mime_type: String,
    pub size: usize,
    pub content_id: Option<String>,
    // We'll handle content separately or save it
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedEmail {
    pub message_id: Option<String>,
    pub subject: Option<String>,
    pub from: Vec<EmailAddress>,
    pub to: Vec<EmailAddress>,
    pub cc: Vec<EmailAddress>,
    pub bcc: Vec<EmailAddress>,
    pub date: Option<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub attachments: Vec<EmailAttachment>,
}

pub fn parse_email(raw_email: &[u8]) -> Result<ParsedEmail, String> {
    let message = Message::parse(raw_email)
        .ok_or_else(|| "Failed to parse email".to_string())?;

    let from = convert_addresses(message.from());
    let to = convert_addresses(message.to());
    let cc = convert_addresses(message.cc());
    let bcc = convert_addresses(message.bcc());

    let attachments = message
        .attachments()
        .map(|att| EmailAttachment {
            filename: att.attachment_name().map(|s| s.to_string()),
            mime_type: att.content_type().map(|c| c.c_type.to_string()).unwrap_or_default(),
            size: att.contents().len(),
            content_id: att.content_id().map(|s| s.to_string()),
        })
        .collect();

    Ok(ParsedEmail {
        message_id: message.message_id().map(|s| s.to_string()),
        subject: message.subject().map(|s| s.to_string()),
        from,
        to,
        cc,
        bcc,
        date: message.date().map(|d| d.to_rfc3339()),
        body_text: message.body_text(0).map(|s| s.to_string()),
        body_html: message.body_html(0).map(|s| s.to_string()),
        attachments,
    })
}

fn convert_addresses(addresses: &mail_parser::HeaderValue) -> Vec<EmailAddress> {
    match addresses {
        mail_parser::HeaderValue::Address(addr) => vec![EmailAddress {
            name: addr.name.clone().map(|s| s.to_string()),
            address: addr.address.as_ref().map(|s| s.to_string()).unwrap_or_default(),
        }],
        mail_parser::HeaderValue::AddressList(list) => list
            .iter()
            .map(|addr| EmailAddress {
                name: addr.name.clone().map(|s| s.to_string()),
                address: addr.address.as_ref().map(|s| s.to_string()).unwrap_or_default(),
            })
            .collect(),
        _ => vec![],
    }
}
