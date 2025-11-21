import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Trash2, Edit } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { MailAccount } from '@/types/mail';

interface AccountCardProps {
  account: MailAccount;
  onEdit: (account: MailAccount) => void;
  onDelete: (accountId: string) => void;
  onSelect: (account: MailAccount) => void;
}

function AccountCard({ account, onEdit, onDelete, onSelect }: AccountCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(account)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{account.name}</CardTitle>
              <CardDescription>{account.email}</CardDescription>
            </div>
          </div>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onEdit(account);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDelete(account.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <div>IMAP: {account.imap.host}:{account.imap.port}</div>
            <div>SMTP: {account.smtp.host}:{account.smtp.port}</div>
          </div>
          <Badge variant={account.lastSync ? 'default' : 'secondary'}>
            {account.lastSync ? '已同步' : '未同步'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountManagement() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const accountsData = await invoke<MailAccount[]>('get_accounts_secure');
      setAccounts(accountsData);
    } catch (err) {
      setError(`加载账户失败: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = () => {
    // Navigate to login page or open modal
    window.location.href = '/login';
  };

  const handleEditAccount = (account: MailAccount) => {
    // TODO: Open edit modal
    console.log('Edit account:', account);
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('确定要删除这个账户吗？这将删除所有相关的邮件数据。')) {
      return;
    }

    try {
      await invoke('delete_account_secure', { accountId });
      await loadAccounts();
    } catch (err) {
      setError(`删除账户失败: ${err}`);
    }
  };

  const handleSelectAccount = (account: MailAccount) => {
    // Set as active account and navigate to mail view
    localStorage.setItem('activeAccountId', account.id);
    window.location.href = '/mail';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">加载账户中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">账户管理</h1>
            <p className="text-muted-foreground mt-2">
              管理您的邮箱账户，添加新账户或编辑现有设置
            </p>
          </div>
          <Button onClick={handleAddAccount} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>添加账户</span>
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
            {error}
          </div>
        )}

        {accounts.length === 0 ? (
          <Card className="text-center py-12">
            <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="text-xl mb-2">还没有邮箱账户</CardTitle>
            <CardDescription className="mb-6">
              添加您的第一个邮箱账户以开始使用 SimpleMail
            </CardDescription>
            <Button onClick={handleAddAccount} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              添加邮箱账户
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account: MailAccount) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEditAccount}
                onDelete={handleDeleteAccount}
                onSelect={handleSelectAccount}
              />
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => window.location.href = '/mail'}>
            进入邮箱
          </Button>
        </div>
      </div>
    </div>
  );
}
