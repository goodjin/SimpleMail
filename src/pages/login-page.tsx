import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Lock, User, Server, Send } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface AccountConfig {
  name: string;
  email: string;
  imap_config: {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
  };
  smtp_config: {
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
  };
}

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AccountConfig>({
    name: '',
    email: '',
    imap_config: {
      host: '',
      port: 993,
      username: '',
      password: '',
      tls: true,
    },
    smtp_config: {
      host: '',
      port: 587,
      username: '',
      password: '',
      from: '',
    },
  });

  const handleTestConnection = async (type: 'imap' | 'smtp') => {
    setIsLoading(true);
    setError(null);

    try {
      if (type === 'imap') {
        // For testing, we need to save the account first to get an ID, then test
        const tempAccountId = await invoke('save_account_secure', { config });
        await invoke('test_imap_connection_secure', { accountId: tempAccountId });
        // Clean up the temp account
        await invoke('delete_account_secure', { accountId: tempAccountId });
      } else {
        const tempAccountId = await invoke('save_account_secure', { config });
        await invoke('test_smtp_connection_secure', { accountId: tempAccountId });
        // Clean up the temp account
        await invoke('delete_account_secure', { accountId: tempAccountId });
      }
      alert(`${type.toUpperCase()} connection test successful!`);
    } catch (err) {
      setError(`${type.toUpperCase()} connection failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const accountId = await invoke('save_account_secure', { config });
      console.log('Account saved:', accountId);
      // Navigate to main app or reload accounts
      window.location.reload();
    } catch (err) {
      setError(`Failed to save account: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = (section: keyof AccountConfig, field: string, value: any) => {
    if (section === 'imap_config' || section === 'smtp_config') {
      setConfig((prev: AccountConfig) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }));
    } else {
      setConfig((prev: AccountConfig) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">SimpleMail</CardTitle>
          <CardDescription>
            添加您的邮箱账户以开始使用
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">基本信息</TabsTrigger>
              <TabsTrigger value="advanced">服务器设置</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">账户名称</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="我的邮箱"
                    value={config.name}
                    onChange={(e) => updateConfig('name' as keyof AccountConfig, 'name', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={config.email}
                    onChange={(e) => updateConfig('name' as keyof AccountConfig, 'email', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">邮箱密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="输入邮箱密码"
                    value={config.imap_config.password}
                    onChange={(e) => {
                      updateConfig('imap_config', 'password', e.target.value);
                      updateConfig('smtp_config', 'password', e.target.value);
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center">
                      <Server className="h-4 w-4 mr-2" />
                      IMAP 设置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="imap-host">服务器</Label>
                      <Input
                        id="imap-host"
                        placeholder="imap.gmail.com"
                        value={config.imap_config.host}
                        onChange={(e) => updateConfig('imap_config', 'host', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="imap-port">端口</Label>
                      <Input
                        id="imap-port"
                        type="number"
                        value={config.imap_config.port}
                        onChange={(e) => updateConfig('imap_config', 'port', parseInt(e.target.value))}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection('imap')}
                      disabled={isLoading}
                      className="w-full"
                    >
                      测试连接
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center">
                      <Send className="h-4 w-4 mr-2" />
                      SMTP 设置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="smtp-host">服务器</Label>
                      <Input
                        id="smtp-host"
                        placeholder="smtp.gmail.com"
                        value={config.smtp_config.host}
                        onChange={(e) => updateConfig('smtp_config', 'host', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-port">端口</Label>
                      <Input
                        id="smtp-port"
                        type="number"
                        value={config.smtp_config.port}
                        onChange={(e) => updateConfig('smtp_config', 'port', parseInt(e.target.value))}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection('smtp')}
                      disabled={isLoading}
                      className="w-full"
                    >
                      测试连接
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="imap-username">IMAP 用户名</Label>
                  <Input
                    id="imap-username"
                    value={config.imap_config.username}
                    onChange={(e) => updateConfig('imap_config', 'username', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="smtp-username">SMTP 用户名</Label>
                  <Input
                    id="smtp-username"
                    value={config.smtp_config.username}
                    onChange={(e) => updateConfig('smtp_config', 'username', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleSaveAccount}
              disabled={isLoading || !config.email || !config.name}
              className="flex-1"
            >
              {isLoading ? '保存中...' : '保存账户'}
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
