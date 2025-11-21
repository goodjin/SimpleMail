export interface EmailAccount {
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
  syncInterval: number; // in minutes
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailFolder {
  accountId: string;
  name: string;
  path: string;
  delimiter: string;
  attributes: string[];
  uidValidity?: number;
  uidNext?: number;
  total?: number;
  unseen?: number;
  messages?: number;
}

export interface EmailIndex {
  accountId: string;
  folder: string;
  uids: number[];
  lastUpdated: string;
}
