import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Inbox, 
  Send, 
  Archive, 
  Trash2, 
  Star, 
  FileText,
  Settings,
  Plus,
  Search,
  ChevronDown,
  Folder,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MailFolder, MailAccount } from '@/types/mail';

interface SidebarProps {
  accounts: MailAccount[];
  folders: MailFolder[];
  activeAccount?: string;
  activeFolder?: string;
  unreadCounts: Record<string, number>;
  onAccountSelect: (accountId: string) => void;
  onFolderSelect: (folderId: string) => void;
  onCompose: () => void;
  onRefresh: () => void;
  onSettings: () => void;
}

interface FolderItemProps {
  folder: MailFolder;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}

function FolderItem({ folder, isActive, unreadCount, onClick }: FolderItemProps) {
  const getFolderIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('inbox')) return <Inbox className="h-4 w-4" />;
    if (lowerName.includes('sent')) return <Send className="h-4 w-4" />;
    if (lowerName.includes('draft')) return <FileText className="h-4 w-4" />;
    if (lowerName.includes('trash')) return <Trash2 className="h-4 w-4" />;
    if (lowerName.includes('archive')) return <Archive className="h-4 w-4" />;
    if (lowerName.includes('star')) return <Star className="h-4 w-4" />;
    return <Folder className="h-4 w-4" />;
  };

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "w-full justify-start gap-2 px-2 py-2 h-auto",
        isActive && "bg-primary/10 text-primary"
      )}
      onClick={onClick}
    >
      {getFolderIcon(folder.name)}
      <span className="flex-1 text-left truncate">{folder.name}</span>
      {unreadCount > 0 && (
        <Badge variant="destructive" className="text-xs">
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
}

export function Sidebar({
  accounts,
  folders,
  activeAccount,
  activeFolder,
  unreadCounts,
  onAccountSelect,
  onFolderSelect,
  onCompose,
  onRefresh,
  onSettings
}: SidebarProps) {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Auto-expand active account
    if (activeAccount) {
      setExpandedAccounts(prev => new Set([...prev, activeAccount]));
    }
  }, [activeAccount]);

  const toggleAccountExpanded = (accountId: string) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const getAccountFolders = (accountId: string) => {
    return folders.filter(folder => folder.id.startsWith(accountId + '-'));
  };

  const getUnreadCount = (folderId: string) => {
    return unreadCounts[folderId] || 0;
  };

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-6 w-6 text-primary" />
          <h1 className="font-semibold text-lg">SimpleMail</h1>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={onCompose} className="flex-1" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            撰写
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索账户..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Accounts and Folders */}
      <div className="flex-1 overflow-auto">
        <div className="p-2">
          {filteredAccounts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">没有找到账户</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onCompose}>
                添加账户
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredAccounts.map((account) => (
                <div key={account.id} className="mb-2">
                  {/* Account header */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 px-2 py-2 h-auto font-medium"
                    onClick={() => toggleAccountExpanded(account.id)}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        !expandedAccounts.has(account.id) && "rotate-90"
                      )}
                    />
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="flex-1 text-left truncate">{account.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {getAccountFolders(account.id).reduce((sum, folder) => sum + getUnreadCount(folder.id), 0)}
                    </Badge>
                  </Button>

                  {/* Folders */}
                  {expandedAccounts.has(account.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {getAccountFolders(account.id).map((folder) => (
                        <FolderItem
                          key={folder.id}
                          folder={folder}
                          isActive={activeFolder === folder.id}
                          unreadCount={getUnreadCount(folder.id)}
                          onClick={() => onFolderSelect(folder.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          <div>共 {accounts.length} 个账户</div>
          <div className="mt-1">
            {Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)} 封未读邮件
          </div>
        </div>
      </div>
    </div>
  );
}
