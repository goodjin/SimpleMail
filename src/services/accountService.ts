import { EmailAccount, EmailFolder, EmailIndex } from "@/types/account";
import { invoke } from "@tauri-apps/api/tauri";
import { v4 as uuidv4 } from 'uuid';

// In-memory cache for accounts
let accountsCache: EmailAccount[] | null = null;

// File paths for data storage
const ACCOUNTS_FILE = 'accounts.json';
const FOLDERS_FILE = 'folders.json';
const INDICES_FILE = 'indices.json';

// Helper function to read JSON files
async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    const content = await invoke<string>('read_text_file', { filename });
    return JSON.parse(content) as T;
  } catch (error) {
    console.warn(`Failed to read ${filename}:`, error);
    return defaultValue;
  }
}

// Helper function to write JSON files
async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  try {
    await invoke('write_text_file', {
      filename,
      content: JSON.stringify(data, null, 2),
    });
  } catch (error) {
    console.error(`Failed to write ${filename}:`, error);
    throw error;
  }
}

export const accountService = {
  // Account Management
  async getAccounts(): Promise<EmailAccount[]> {
    if (accountsCache) return accountsCache;
    accountsCache = await readJsonFile<EmailAccount[]>(ACCOUNTS_FILE, []);
    return accountsCache;
  },

  async getAccount(id: string): Promise<EmailAccount | undefined> {
    const accounts = await this.getAccounts();
    return accounts.find(acc => acc.id === id);
  },

  async saveAccount(account: Omit<EmailAccount, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<EmailAccount> {
    const accounts = await this.getAccounts();
    const now = new Date().toISOString();
    
    let updatedAccount: EmailAccount;
    
    if (account.id) {
      // Update existing account
      const index = accounts.findIndex(acc => acc.id === account.id);
      if (index === -1) throw new Error('Account not found');
      
      updatedAccount = {
        ...account as EmailAccount,
        updatedAt: now
      };
      
      accounts[index] = updatedAccount;
    } else {
      // Create new account
      updatedAccount = {
        ...account,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
      } as EmailAccount;
      
      accounts.push(updatedAccount);
    }
    
    await writeJsonFile(ACCOUNTS_FILE, accounts);
    accountsCache = accounts;
    return updatedAccount;
  },

  async deleteAccount(id: string): Promise<void> {
    const accounts = await this.getAccounts();
    const newAccounts = accounts.filter(acc => acc.id !== id);
    
    if (newAccounts.length === accounts.length) {
      throw new Error('Account not found');
    }
    
    await writeJsonFile(ACCOUNTS_FILE, newAccounts);
    accountsCache = newAccounts;
    
    // Clean up related data
    await this.deleteFoldersByAccount(id);
    await this.deleteIndicesByAccount(id);
  },

  // Folder Management
  async getFolders(accountId: string): Promise<EmailFolder[]> {
    const allFolders = await readJsonFile<Record<string, EmailFolder[]>>(FOLDERS_FILE, {});
    return allFolders[accountId] || [];
  },

  async saveFolders(accountId: string, folders: EmailFolder[]): Promise<void> {
    const allFolders = await readJsonFile<Record<string, EmailFolder[]>>(FOLDERS_FILE, {});
    allFolders[accountId] = folders;
    await writeJsonFile(FOLDERS_FILE, allFolders);
  },

  async deleteFoldersByAccount(accountId: string): Promise<void> {
    const allFolders = await readJsonFile<Record<string, EmailFolder[]>>(FOLDERS_FILE, {});
    if (allFolders[accountId]) {
      delete allFolders[accountId];
      await writeJsonFile(FOLDERS_FILE, allFolders);
    }
  },

  // Email Index Management
  async getIndices(accountId: string, folder: string): Promise<EmailIndex | null> {
    const allIndices = await readJsonFile<Record<string, Record<string, EmailIndex>>>(
      INDICES_FILE,
      {}
    );
    return allIndices[accountId]?.[folder] || null;
  },

  async saveIndex(index: EmailIndex): Promise<void> {
    const allIndices = await readJsonFile<Record<string, Record<string, EmailIndex>>>(
      INDICES_FILE,
      {}
    );
    
    if (!allIndices[index.accountId]) {
      allIndices[index.accountId] = {};
    }
    
    allIndices[index.accountId][index.folder] = {
      ...index,
      lastUpdated: new Date().toISOString(),
    };
    
    await writeJsonFile(INDICES_FILE, allIndices);
  },

  async deleteIndicesByAccount(accountId: string): Promise<void> {
    const allIndices = await readJsonFile<Record<string, Record<string, EmailIndex>>>(
      INDICES_FILE,
      {}
    );
    
    if (allIndices[accountId]) {
      delete allIndices[accountId];
      await writeJsonFile(INDICES_FILE, allIndices);
    }
  },

  // Sync status
  async updateLastSync(accountId: string): Promise<void> {
    const accounts = await this.getAccounts();
    const account = accounts.find(acc => acc.id === accountId);
    
    if (account) {
      account.lastSync = new Date().toISOString();
      await this.saveAccount(account);
    }
  },
};
