import { Mail, MailFolder, NewMail, MailAccount, MailBase } from "@/types/mail";
import { ImapService, ImapEmail, ImapFolder } from "./imapService";

// In-memory storage for demo purposes
let mailFolders: MailFolder[] = [
  { id: 'inbox', name: '收件箱', icon: 'inbox', count: 0, specialUse: 'inbox' },
  { id: 'sent', name: '已发送', icon: 'send', specialUse: 'sent' },
  { id: 'drafts', name: '草稿', icon: 'file-text', specialUse: 'drafts' },
  { id: 'trash', name: '垃圾箱', icon: 'trash', specialUse: 'trash' },
  { id: 'spam', name: '垃圾邮件', icon: 'alert-circle', specialUse: 'spam' },
];

let mockEmails: Mail[] = [];
let connectedAccounts: Map<string, MailAccount> = new Map();

// Convert ImapEmail to Mail format
function imapEmailToMail(imapEmail: ImapEmail, accountId: string): Mail {
  return {
    id: imapEmail.id,
    from: imapEmail.from,
    to: imapEmail.to,
    subject: imapEmail.subject,
    body: imapEmail.body,
    date: imapEmail.date,
    read: imapEmail.read,
    starred: imapEmail.starred,
    labels: [],
    hasAttachments: imapEmail.has_attachments,
    folderId: imapEmail.folder,
    accountId, // Add required accountId
  };
}

// Convert ImapFolder to MailFolder format
function imapFolderToMailFolder(imapFolder: ImapFolder): MailFolder {
  const id = imapFolder.name.toLowerCase().replace(' ', '-');
  let icon = 'folder';
  let specialUse: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'junk' | undefined;

  // Map common folder names to icons and special uses
  if (imapFolder.name.toLowerCase().includes('inbox')) {
    icon = 'inbox';
    specialUse = 'inbox';
  } else if (imapFolder.name.toLowerCase().includes('sent')) {
    icon = 'send';
    specialUse = 'sent';
  } else if (imapFolder.name.toLowerCase().includes('draft')) {
    icon = 'file-text';
    specialUse = 'drafts';
  } else if (imapFolder.name.toLowerCase().includes('trash') || imapFolder.name.toLowerCase().includes('deleted')) {
    icon = 'trash';
    specialUse = 'trash';
  } else if (imapFolder.name.toLowerCase().includes('spam') || imapFolder.name.toLowerCase().includes('junk')) {
    icon = 'alert-circle';
    specialUse = 'spam';
  } else if (imapFolder.name.toLowerCase().includes('archive')) {
    icon = 'archive';
    specialUse = 'archive';
  }

  return {
    id,
    name: imapFolder.name,
    icon,
    count: imapFolder.message_count || 0,
    specialUse,
  };
}

// Helper function to generate a mock email
function createMockMail(accountId: string, folderId: string, overrides: Partial<MailBase> = {}): Mail {
  const timestamp = Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
  const date = new Date(timestamp).toISOString();
  
  return {
    id: `mail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: `sender-${Math.floor(Math.random() * 5)}@example.com`,
    to: [`${accountId.split('@')[0]}@example.com`],
    subject: `Test Email ${Math.floor(Math.random() * 1000)}`,
    body: 'This is a test email body.\n\nBest regards,\nSender',
    date,
    read: false,
    starred: false,
    labels: [],
    hasAttachments: false,
    folderId,
    accountId,
    ...overrides
  };
}

// Initialize with some test data
function initializeTestData(accountId: string) {
  // Add some test emails to inbox
  for (let i = 0; i < 15; i++) {
    mockEmails.push(createMockMail(accountId, 'inbox', {
      read: i > 5, // First 5 emails are unread
      starred: i % 4 === 0, // Every 4th email is starred
    }));
  }

  // Add some sent emails
  for (let i = 0; i < 5; i++) {
    mockEmails.push(createMockMail(accountId, 'sent', {
      from: `${accountId}`,
      to: [`recipient-${i}@example.com`],
      read: true,
    }));
  }
}

// Individual function implementations
async function getFolders(accountId: string): Promise<MailFolder[]> {
  // Initialize test data on first folder fetch
  if (mockEmails.length === 0) {
    initializeTestData(accountId);
  }
  
  // Update folder counts
  return mailFolders.map(folder => ({
    ...folder,
    count: mockEmails.filter(mail => mail.folderId === folder.id).length
  }));
}

async function getMails(accountId: string, folderId: string, page = 1, pageSize = 20): Promise<{ mails: Mail[]; total: number }> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const filteredMails = mockEmails.filter(mail => mail.folderId === folderId && mail.accountId === accountId);
  
  // Sort by date, newest first
  const sortedMails = [...filteredMails].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  return {
    mails: sortedMails.slice(start, end),
    total: filteredMails.length,
  };
}

async function getMail(accountId: string, folderId: string, id: string): Promise<Mail | undefined> {
  return mockEmails.find(mail => 
    mail.id === id && 
    mail.folderId === folderId && 
    mail.accountId === accountId
  );
}

async function sendMail(mail: NewMail, accountId: string): Promise<Mail> {
  // Extract account email from accountId (in a real app, this would come from the account service)
  const from = `${accountId.split('@')[0]}@example.com`;
  
  const newMail: Mail = {
    ...mail,
    id: `mail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from,
    date: new Date().toISOString(),
    read: true,
    starred: false,
    labels: [],
    hasAttachments: !!(mail.attachments && mail.attachments.length > 0),
    folderId: 'sent',
    accountId,
    inReplyTo: mail.inReplyTo,
    references: mail.references || [],
  };
  
  mockEmails.push(newMail);
  return newMail;
}

async function moveMails(ids: string[], targetFolderId: string): Promise<void> {
  mockEmails = mockEmails.map(mail => 
    ids.includes(mail.id) ? { ...mail, folderId: targetFolderId } : mail
  );
}

async function deleteMails(ids: string[]): Promise<void> {
  // Move to trash instead of deleting
  await moveMails(ids, 'trash');
}

async function markAsRead(ids: string[], read: boolean): Promise<void> {
  mockEmails = mockEmails.map(mail => 
    ids.includes(mail.id) ? { ...mail, read } : mail
  );
}

async function toggleStar(ids: string[], starred: boolean): Promise<void> {
  mockEmails = mockEmails.map(mail => 
    ids.includes(mail.id) ? { ...mail, starred } : mail
  );
}

async function syncAccount(accountId: string): Promise<{ success: boolean; message: string }> {
  // In a real app, this would sync with the IMAP server
  return new Promise(resolve => {
    setTimeout(() => {
      // Simulate new emails arriving
      const newEmailCount = Math.floor(Math.random() * 3); // 0-2 new emails
      for (let i = 0; i < newEmailCount; i++) {
        mockEmails.unshift(createMockMail(accountId, 'inbox'));
      }
      
      resolve({
        success: true,
        message: newEmailCount > 0 
          ? `Synced ${newEmailCount} new emails`
          : 'No new emails',
      });
    }, 1000);
  });
}

// Export individual functions
export { getFolders, getMails, getMail, sendMail, moveMails, deleteMails, markAsRead, toggleStar, syncAccount };

// Default export for backward compatibility
export const mailService = {
  // Account management
  async getAccounts(): Promise<MailAccount[]> {
    // In a real app, this would fetch from the database
    return [];
  },

  // Folder operations
  async getFolders(accountId: string): Promise<MailFolder[]> {
    // Initialize test data on first folder fetch
    if (mockEmails.length === 0) {
      initializeTestData(accountId);
    }
    
    // Update folder counts
    return mailFolders.map(folder => ({
      ...folder,
      count: mockEmails.filter(mail => mail.folderId === folder.id).length
    }));
  },

  async createFolder(folder: Omit<MailFolder, 'id'>): Promise<MailFolder> {
    const newFolder: MailFolder = {
      ...folder,
      id: `folder-${Date.now()}`,
    };
    mailFolders.push(newFolder);
    return newFolder;
  },

  // Email operations
  async getMails(folderId: string, page = 1, pageSize = 20): Promise<{ mails: Mail[]; total: number }> {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const filteredMails = mockEmails.filter(mail => mail.folderId === folderId);
    
    // Sort by date, newest first
    const sortedMails = [...filteredMails].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return {
      mails: sortedMails.slice(start, end),
      total: filteredMails.length,
    };
  },

  async getMail(id: string): Promise<Mail | undefined> {
    const mail = mockEmails.find(email => email.id === id);
    if (mail) {
      // Mark as read when fetched
      if (!mail.read) {
        await this.markAsRead([id], true);
      }
      return mail;
    }
    return undefined;
  },

  async sendMail(mail: NewMail, accountId: string): Promise<Mail> {
    // In a real app, this would connect to the SMTP server
    const newMail: Mail = {
      ...mail,
      id: `mail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: accountId, // The sender is the account email
      date: new Date().toISOString(),
      read: true,
      starred: false,
      labels: [],
      hasAttachments: !!(mail.attachments && mail.attachments.length > 0),
      folderId: 'sent',
      accountId,
    };

    mockEmails.unshift(newMail);
    return newMail;
  },

  async moveMails(ids: string[], targetFolderId: string): Promise<void> {
    mockEmails = mockEmails.map(mail => 
      ids.includes(mail.id) ? { ...mail, folderId: targetFolderId } : mail
    );
  },

  async deleteMails(ids: string[]): Promise<void> {
    // Move to trash instead of deleting
    await this.moveMails(ids, 'trash');
  },

  async markAsRead(ids: string[], read: boolean): Promise<void> {
    mockEmails = mockEmails.map(mail => 
      ids.includes(mail.id) ? { ...mail, read } : mail
    );
  },

  async toggleStar(ids: string[], starred: boolean): Promise<void> {
    mockEmails = mockEmails.map(mail => 
      ids.includes(mail.id) ? { ...mail, starred } : mail
    );
  },

  // Sync operations
  async syncAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      const account = connectedAccounts.get(accountId);
      if (!account) {
        return { success: false, message: 'Account not found' };
      }

      // Test if already connected
      try {
        await ImapService.testConnection(account.imap);
      } catch (error) {
        // Try to connect
        await ImapService.connect(accountId, account.imap);
      }

      // Fetch folders
      const imapFolders = await ImapService.listFolders(accountId);
      
      // Update mail folders with real IMAP folders
      const newFolders = imapFolders.map(imapFolderToMailFolder);
      mailFolders = [...mailFolders.filter(f => f.specialUse), ...newFolders];

      // Fetch emails from INBOX
      const imapEmails = await ImapService.fetchEmails(accountId, 'INBOX', 50);
      
      // Convert and add emails
      const newMails = imapEmails.map(imapEmail => imapEmailToMail(imapEmail, accountId));
      
      // Update mock emails with real ones (avoid duplicates by ID)
      const existingIds = new Set(mockEmails.map(m => m.id));
      const uniqueNewMails = newMails.filter(mail => !existingIds.has(mail.id));
      mockEmails = [...uniqueNewMails, ...mockEmails];

      return {
        success: true,
        message: `Synced ${uniqueNewMails.length} new emails`,
      };
    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        message: `Sync failed: ${error}`,
      };
    }
  },

  // IMAP-specific operations
  async connectImap(account: MailAccount): Promise<{ success: boolean; message: string }> {
    try {
      await ImapService.connect(account.id, account.imap);
      connectedAccounts.set(account.id, account);
      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error}` };
    }
  },

  async disconnectImap(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      await ImapService.disconnect(accountId);
      connectedAccounts.delete(accountId);
      return { success: true, message: 'Disconnected successfully' };
    } catch (error) {
      return { success: false, message: `Disconnection failed: ${error}` };
    }
  },

  async fetchImapEmails(accountId: string, folder: string, limit: number = 50): Promise<Mail[]> {
    try {
      const imapEmails = await ImapService.fetchEmails(accountId, folder, limit);
      return imapEmails.map(email => imapEmailToMail(email, accountId));
    } catch (error) {
      console.error('Failed to fetch IMAP emails:', error);
      return [];
    }
  },

  async markImapEmail(accountId: string, folder: string, uid: number, action: 'read' | 'starred' | 'delete'): Promise<{ success: boolean; message: string }> {
    try {
      const result = await ImapService.markEmail(accountId, folder, uid, action);
      
      // Also update local cache
      const emailId = `${folder}-${uid}`;
      mockEmails = mockEmails.map(mail => {
        if (mail.id === emailId) {
          switch (action) {
            case 'read':
              return { ...mail, read: true };
            case 'starred':
              return { ...mail, starred: true };
            case 'delete':
              return { ...mail, folderId: 'trash' };
            default:
              return mail;
          }
        }
        return mail;
      });

      return { success: true, message: result };
    } catch (error) {
      return { success: false, message: `Action failed: ${error}` };
    }
  },
};
