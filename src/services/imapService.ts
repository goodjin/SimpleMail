import { invoke } from '@tauri-apps/api/tauri';

export interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

export interface ImapEmail {
  id: string;
  uid: number;
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  has_attachments: boolean;
  folder: string;
}

export interface ImapFolder {
  name: string;
  delimiter: string;
  flags: string[];
  message_count?: number;
}

export interface ConnectRequest {
  account_id: string;
  imap_config: ImapConfig;
}

export interface FetchEmailsRequest {
  account_id: string;
  folder: string;
  limit?: number;
}

export interface MarkEmailRequest {
  account_id: string;
  folder: string;
  uid: number;
  action: 'read' | 'starred' | 'delete';
}

export class ImapService {
  static async testConnection(config: ImapConfig): Promise<string> {
    return await invoke<string>('imap_test_connection', { imapConfig: config });
  }

  static async connect(accountId: string, config: ImapConfig): Promise<string> {
    const request: ConnectRequest = {
      account_id: accountId,
      imap_config: config,
    };
    return await invoke<string>('imap_connect', { request });
  }

  static async disconnect(accountId: string): Promise<string> {
    return await invoke<string>('imap_disconnect', { accountId });
  }

  static async listFolders(accountId: string): Promise<ImapFolder[]> {
    return await invoke<ImapFolder[]>('imap_list_folders', { accountId });
  }

  static async fetchEmails(accountId: string, folder: string, limit: number = 50): Promise<ImapEmail[]> {
    const request: FetchEmailsRequest = {
      account_id: accountId,
      folder,
      limit,
    };
    return await invoke<ImapEmail[]>('imap_fetch_emails', { request });
  }

  static async markEmail(accountId: string, folder: string, uid: number, action: MarkEmailRequest['action']): Promise<string> {
    const request: MarkEmailRequest = {
      account_id: accountId,
      folder,
      uid,
      action,
    };
    return await invoke<string>('imap_mark_email', { request });
  }
}
