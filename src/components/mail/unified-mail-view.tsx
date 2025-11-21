import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Send, 
  Inbox, 
  Archive, 
  Trash2, 
  Star, 
  Search,
  Filter,
  RefreshCw,
  Settings,
  Menu,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical
} from 'lucide-react';
import { Mail as MailType, MailAccount, MailFolder } from '@/types/mail';
import { cn } from '@/lib/utils';

// Import components
import { Sidebar } from './sidebar';
import { VirtualizedEmailList } from './virtualized-email-list';
import { EmailViewer } from './email-viewer';
import { ComposeEmail } from './compose-email';
import { SearchBar, SearchFilters, SearchResults } from './search';
import { AttachmentUpload, AttachmentList, AttachmentPreview } from './attachments';

export interface MailClientProps {
  accounts: MailAccount[];
  folders: MailFolder[];
  selectedAccount?: string;
  selectedFolder?: string;
  selectedEmail?: MailType;
  emails: MailType[];
  isLoading?: boolean;
  onAccountSelect: (accountId: string) => void;
  onFolderSelect: (folderId: string) => void;
  onEmailSelect: (email: MailType) => void;
  onRefresh: () => void;
  onCompose: () => void;
  onReply: (email: MailType) => void;
  onForward: (email: MailType) => void;
  onDelete: (emailIds: string[]) => void;
  onMarkAsRead: (emailIds: string[]) => void;
  onMarkAsUnread: (emailIds: string[]) => void;
  onStar: (emailIds: string[]) => void;
  onUnstar: (emailIds: string[]) => void;
  onMove: (emailIds: string[], targetFolderId: string) => void;
  onSearch: (query: string, filters?: any) => void;
  onSendEmail: (email: any) => void;
}

type ViewMode = 'inbox' | 'sent' | 'drafts' | 'trash' | 'search' | 'starred';

export function UnifiedMailView({
  accounts,
  folders,
  selectedAccount,
  selectedFolder,
  selectedEmail,
  emails,
  isLoading = false,
  onAccountSelect,
  onFolderSelect,
  onEmailSelect,
  onRefresh,
  onCompose,
  onReply,
  onForward,
  onDelete,
  onMarkAsRead,
  onMarkAsUnread,
  onStar,
  onUnstar,
  onMove,
  onSearch,
  onSendEmail
}: MailClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<MailType | undefined>();
  const [forwardEmail, setForwardEmail] = useState<MailType | undefined>();

  // Handle email selection
  const handleEmailSelect = useCallback((email: MailType) => {
    onEmailSelect(email);
    if (!email.read) {
      onMarkAsRead([email.id]);
    }
  }, [onEmailSelect, onMarkAsRead]);

  // Handle bulk actions
  const handleSelectAll = () => {
    if (selectedEmailIds.size === emails.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(emails.map(e => e.id)));
    }
  };

  const handleEmailSelectToggle = (emailId: string) => {
    const newSelected = new Set(selectedEmailIds);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmailIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedEmailIds.size > 0) {
      onDelete(Array.from(selectedEmailIds));
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkMarkAsRead = () => {
    if (selectedEmailIds.size > 0) {
      onMarkAsRead(Array.from(selectedEmailIds));
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkMarkAsUnread = () => {
    if (selectedEmailIds.size > 0) {
      onMarkAsUnread(Array.from(selectedEmailIds));
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkStar = () => {
    if (selectedEmailIds.size > 0) {
      onStar(Array.from(selectedEmailIds));
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkUnstar = () => {
    if (selectedEmailIds.size > 0) {
      onUnstar(Array.from(selectedEmailIds));
      setSelectedEmailIds(new Set());
    }
  };

  // Handle compose actions
  const handleReply = (email: MailType) => {
    setReplyToEmail(email);
    setShowCompose(true);
  };

  const handleForward = (email: MailType) => {
    setForwardEmail(email);
    setShowCompose(true);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
    setReplyToEmail(undefined);
    setForwardEmail(undefined);
  };

  const handleSendEmail = (emailData: any) => {
    onSendEmail(emailData);
    handleCloseCompose();
  };

  // Handle search
  const handleSearch = (query: string, filters?: any) => {
    setSearchQuery(query);
    onSearch(query, filters);
    if (query) {
      setViewMode('search');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearch(false);
    setViewMode('inbox');
  };

  // Get current folder emails
  const getCurrentEmails = () => {
    if (viewMode === 'search') {
      return emails;
    }
    
    if (viewMode === 'starred') {
      return emails.filter(email => email.starred);
    }
    
    return emails;
  };

  const currentEmails = getCurrentEmails();
  const unreadCount = currentEmails.filter(email => !email.read).length;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={cn(
        "transition-all duration-300 border-r",
        sidebarOpen ? "w-64" : "w-0 overflow-hidden"
      )}>
        <Sidebar
              accounts={accounts}
              folders={folders}
              selectedAccount={selectedAccount}
              selectedFolder={selectedFolder}
              onAccountSelect={onAccountSelect}
              onFolderSelect={onFolderSelect}
              onCompose={() => setShowCompose(true)}
            />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                {viewMode === 'inbox' && <Inbox className="h-4 w-4" />}
                {viewMode === 'sent' && <Send className="h-4 w-4" />}
                {viewMode === 'drafts' && <Mail className="h-4 w-4" />}
                {viewMode === 'trash' && <Trash2 className="h-4 w-4" />}
                {viewMode === 'search' && <Search className="h-4 w-4" />}
                {viewMode === 'starred' && <Star className="h-4 w-4" />}
                
                <span className="font-medium capitalize">
                  {viewMode === 'search' ? 'Search Results' : viewMode}
                </span>
                
                {unreadCount > 0 && viewMode !== 'sent' && (
                  <Badge variant="secondary">{unreadCount}</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Bar */}
              {showSearch ? (
                <div className="flex items-center gap-2">
                  <SearchBar
                    onSearch={(filters: { query: string }) => handleSearch(filters.query)}
                    onClear={clearSearch}
                    placeholder="Search emails..."
                  />
                  <Button variant="ghost" size="sm" onClick={() => setShowSearch(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowSearch(true)}>
                  <Search className="h-4 w-4" />
                </Button>
              )}

              {/* Actions */}
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              
              <Button variant="ghost" size="sm" onClick={() => setShowCompose(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedEmailIds.size > 0 && (
            <div className="border-t px-4 py-2 bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedEmailIds.size} selected
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={handleBulkMarkAsRead}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleBulkMarkAsUnread}>
                    <EyeOff className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleBulkStar}>
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleBulkUnstar}>
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div className={cn(
            "border-r bg-card",
            selectedEmail ? "w-2/5" : "w-full"
          )}>
            <VirtualizedEmailList
              mails={currentEmails}
              selectedMailIds={selectedEmailIds}
              onSelectMail={handleEmailSelect}
              onToggleRead={(mailId) => {
                const email = emails.find(e => e.id === mailId);
                if (email) {
                  if (email.read) {
                    onMarkAsUnread([mailId]);
                  } else {
                    onMarkAsRead([mailId]);
                  }
                }
              }}
              onToggleStar={(mailId) => {
                const email = emails.find(e => e.id === mailId);
                if (email) {
                  if (email.starred) {
                    onUnstar([mailId]);
                  } else {
                    onStar([mailId]);
                  }
                }
              }}
              onToggleSelect={handleEmailSelectToggle}
            />
          </div>

          {/* Email Viewer */}
          {selectedEmail && (
            <div className="flex-1 bg-card">
              <EmailViewer
                mail={selectedEmail}
                onReply={() => handleReply(selectedEmail)}
                onReplyAll={() => handleReply(selectedEmail)}
                onForward={() => handleForward(selectedEmail)}
                onArchive={() => onMove([selectedEmail.id], 'archive')}
                onDelete={() => onDelete([selectedEmail.id])}
                onMarkAsRead={() => onMarkAsRead([selectedEmail.id])}
                onMarkAsUnread={() => onMarkAsUnread([selectedEmail.id])}
                onToggleStar={() => {
                  if (selectedEmail.starred) {
                    onUnstar([selectedEmail.id]);
                  } else {
                    onStar([selectedEmail.id]);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeEmail
          replyTo={replyToEmail}
          forwardOf={forwardEmail}
          onClose={handleCloseCompose}
          onSend={handleSendEmail}
        />
      )}
    </div>
  );
}
