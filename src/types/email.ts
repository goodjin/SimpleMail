export interface EmailAddress {
    name?: string;
    address: string;
}

export interface EmailAttachment {
    filename?: string;
    mime_type: string;
    size: number;
    content_id?: string;
}

export interface ParsedEmail {
    message_id?: string;
    subject?: string;
    from: EmailAddress[];
    to: EmailAddress[];
    cc: EmailAddress[];
    bcc: EmailAddress[];
    date?: string;
    body_text?: string;
    body_html?: string;
    attachments: EmailAttachment[];
}
