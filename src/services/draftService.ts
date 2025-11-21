import { v4 as uuidv4 } from 'uuid';
import { NewMail, MailAttachment } from '@/types/mail';

const DRAFT_STORAGE_KEY = 'mail_drafts';

interface DraftBase extends Omit<NewMail, 'to' | 'attachments'> {
  to: string[];
  attachments: Array<Omit<MailAttachment, 'content'>>;
  isDraft: true;
  draftId: string;
  lastSaved: string;
  id: string;
  from: string;
  date: string;
  read: boolean;
  starred: boolean;
  labels: string[];
  hasAttachments: boolean;
  folderId: string;
  accountId: string;
}

type Draft = DraftBase;

export const draftService = {
  // Save a new or update existing draft
  async saveDraft(draft: Partial<NewMail> & { 
    draftId?: string;
    from?: string;
    to?: string | string[];
  }): Promise<Draft> {
    const drafts = await this.getAllDrafts();
    const now = new Date().toISOString();
    
    const draftData: Draft = {
      ...draft,
      id: draft.draftId || `draft_${uuidv4()}`,
      draftId: draft.draftId || `draft_${uuidv4()}`,
      isDraft: true,
      from: draft.from || 'me@example.com', // This should come from the current user
      date: now,
      lastSaved: now,
      read: true,
      starred: false,
      labels: [],
      hasAttachments: !!(draft.attachments && draft.attachments.length > 0),
      folderId: 'drafts',
      accountId: 'default', // Should come from the current account
      to: draft.to || [],
      subject: draft.subject || '(No subject)',
      body: draft.body || '',
      attachments: draft.attachments || [],
    };

    // Remove existing draft if updating
    const updatedDrafts = drafts.filter(d => d.draftId !== draft.draftId);
    updatedDrafts.push(draftData);
    
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updatedDrafts));
    return draftData;
  },

  // Get all drafts
  async getAllDrafts(): Promise<Draft[]> {
    if (typeof window === 'undefined') return [];
    const drafts = localStorage.getItem(DRAFT_STORAGE_KEY);
    return drafts ? JSON.parse(drafts) : [];
  },

  // Get a single draft by ID
  async getDraft(id: string): Promise<Draft | undefined> {
    const drafts = await this.getAllDrafts();
    return drafts.find(d => d.id === id || d.draftId === id);
  },

  // Delete a draft
  async deleteDraft(id: string): Promise<void> {
    const drafts = await this.getAllDrafts();
    const updatedDrafts = drafts.filter(d => d.id !== id && d.draftId !== id);
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updatedDrafts));
  },

  // Convert draft to a sendable mail
  prepareDraftForSending(draft: Draft): NewMail {
    return {
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      htmlBody: draft.htmlBody,
      // Add empty content to attachments since we omitted it earlier
      attachments: draft.attachments.map(att => ({
        ...att,
        content: '' // This will be populated when sending
      })),
      inReplyTo: draft.inReplyTo,
      references: draft.references,
    };
  },

  // Auto-save draft with debounce
  createAutoSave(draft: Partial<NewMail> & { draftId?: string }) {
    let timeoutId: NodeJS.Timeout | null = null;
    const DEBOUNCE_DELAY = 2000; // 2 seconds

    return {
      trigger: (onSave?: (draft: Draft) => void) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(async () => {
          const savedDraft = await this.saveDraft(draft);
          if (onSave) onSave(savedDraft);
        }, DEBOUNCE_DELAY);
      },
      cancel: () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };
  }
};
