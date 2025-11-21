export interface MailBase {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  date: string;
  read: boolean;
  starred: boolean;
  labels: string[];
  hasAttachments: boolean;
  folderId: string;
  accountId: string;
  inReplyTo?: string;
  references?: string[];
}

export interface Mail extends MailBase {
  // Additional properties for display
  attachments?: MailAttachment[];
  isDraft?: boolean;
  draftId?: string; // Unique ID for drafts
  lastSaved?: string; // ISO timestamp of last save
}

export interface NewMail {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: MailAttachment[];
  inReplyTo?: string;
  references?: string[];
  folderId?: string;
  accountId?: string;
}

export interface MailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  content: string; // base64 encoded
}

export interface MailFolder {
  id: string;
  name: string;
  icon: string;
  count?: number;
  syncState?: string;
  readonly?: boolean;
  specialUse?: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'junk';
}

export interface MailAccount {
  id: string;
  name: string;
  email: string;
  imap: {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
  };
  smtp: {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
  };
  syncInterval: number;
  lastSync?: string;
  signature?: string;
}
