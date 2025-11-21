import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailAccount } from "@/types/account";
import { accountService } from "@/services/accountService";
import { mailService } from "@/services/mailService";

// Simple toast implementation since we don't have the use-toast hook
const useToast = () => {
  return {
    toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
      const { title, description, variant = 'default' } = options;
      const bgColor = variant === 'destructive' ? 'bg-red-500' : 'bg-green-500';
      const toast = document.createElement('div');
      toast.className = `fixed top-4 right-4 ${bgColor} text-white p-4 rounded-md shadow-lg max-w-md z-50`;
      toast.innerHTML = `
        <h3 class="font-bold">${title}</h3>
        ${description ? `<p class="text-sm">${description}</p>` : ''}
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  };
};

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  imap: z.object({
    host: z.string().min(1, "IMAP host is required"),
    port: z.coerce
      .number()
      .min(1, "Port must be between 1 and 65535")
      .max(65535, "Port must be between 1 and 65535")
      .default(993),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    tls: z.boolean().default(true),
  }),
  smtp: z.object({
    host: z.string().min(1, "SMTP host is required"),
    port: z.coerce
      .number()
      .min(1, "Port must be between 1 and 65535")
      .max(65535, "Port must be between 1 and 65535")
      .default(465),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    tls: z.boolean().default(true),
  }),
  syncInterval: z.coerce
    .number()
    .min(1, "Sync interval must be at least 1 minute")
    .max(1440, "Sync interval cannot exceed 1440 minutes (24 hours)")
    .default(5),
});

type AccountFormData = z.infer<typeof accountSchema>;

export function AccountSettings() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema) as any, // Type assertion to fix the type mismatch
    defaultValues: {
      name: "",
      email: "",
      imap: { 
        host: "",
        port: 993,
        username: "",
        password: "",
        tls: true 
      },
      smtp: { 
        host: "",
        port: 465,
        username: "",
        password: "",
        tls: true 
      },
      syncInterval: 5,
    },
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error("Failed to load accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load email accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = (account: EmailAccount) => {
    setSelectedAccount(account.id);
    reset({
      name: account.name,
      email: account.email,
      imap: account.imap,
      smtp: account.smtp,
      syncInterval: account.syncInterval,
    });
  };

  const handleNewAccount = () => {
    setSelectedAccount(null);
    reset({
      name: "",
      email: "",
      imap: { host: "", port: 993, username: "", password: "", tls: true },
      smtp: { host: "", port: 465, username: "", password: "", tls: true },
      syncInterval: 5,
    });
  };

  const testImapConnection = async () => {
    try {
      setTestingConnection(true);
      const values = getValues();
      const accountData = { ...values, id: selectedAccount || 'test' };
      
      const result = await mailService.connectImap(accountData);
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: result.message,
        });
        // Disconnect after successful test
        await mailService.disconnectImap(accountData.id);
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      toast({
        title: "Connection Error",
        description: "Failed to test IMAP connection",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit: SubmitHandler<AccountFormData> = async (data) => {
    try {
      setIsLoading(true);
      if (selectedAccount) {
        await accountService.saveAccount({ ...data, id: selectedAccount });
        toast({
          title: "Success",
          description: "Account updated successfully",
        });
      } else {
        await accountService.saveAccount(data);
        toast({
          title: "Success",
          description: "Account created successfully",
        });
      }
      await loadAccounts();
    } catch (error) {
      console.error("Failed to save account:", error);
      toast({
        title: "Error",
        description: "Failed to save account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    
    try {
      setIsLoading(true);
      await accountService.deleteAccount(id);
      await loadAccounts();
      if (selectedAccount === id) {
        handleNewAccount();
      }
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete account:", error);
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Email Account Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Account List */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>Manage your email accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 rounded-md cursor-pointer ${
                      selectedAccount === account.id ? "bg-accent" : "hover:bg-muted"
                    }`}
                    onClick={() => handleSelectAccount(account)}
                  >
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-muted-foreground">{account.email}</div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={handleNewAccount}
                >
                  Add Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Form */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedAccount ? "Edit Account" : "Add New Account"}
              </CardTitle>
              <CardDescription>
                {selectedAccount
                  ? "Update your email account settings"
                  : "Add a new email account to get started"}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Work Email"
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <Tabs defaultValue="imap" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="imap">IMAP Settings</TabsTrigger>
                    <TabsTrigger value="smtp">SMTP Settings</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="imap" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="imap.host">IMAP Host</Label>
                        <Input
                          id="imap.host"
                          placeholder="imap.example.com"
                          {...register("imap.host")}
                        />
                        {errors.imap?.host && (
                          <p className="text-sm text-red-500">{errors.imap.host.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imap.port">Port</Label>
                        <Input
                          id="imap.port"
                          type="number"
                          {...register("imap.port")}
                        />
                        {errors.imap?.port && (
                          <p className="text-sm text-red-500">{errors.imap.port.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="imap.username">Username</Label>
                        <Input
                          id="imap.username"
                          placeholder="Your username"
                          {...register("imap.username")}
                        />
                        {errors.imap?.username && (
                          <p className="text-sm text-red-500">{errors.imap.username.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imap.password">Password</Label>
                        <Input
                          id="imap.password"
                          type="password"
                          placeholder="Your password"
                          {...register("imap.password")}
                        />
                        {errors.imap?.password && (
                          <p className="text-sm text-red-500">{errors.imap.password.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="imap-tls" {...register("imap.tls")} defaultChecked />
                      <Label htmlFor="imap-tls">Use TLS/SSL</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testImapConnection}
                        disabled={testingConnection}
                      >
                        {testingConnection ? "Testing..." : "Test IMAP Connection"}
                      </Button>
                      <span className="text-sm text-gray-500">
                        Test your IMAP server connection before saving
                      </span>
                    </div>
                  </TabsContent>

                  <TabsContent value="smtp" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp.host">SMTP Host</Label>
                        <Input
                          id="smtp.host"
                          placeholder="smtp.example.com"
                          {...register("smtp.host")}
                        />
                        {errors.smtp?.host && (
                          <p className="text-sm text-red-500">{errors.smtp.host.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp.port">Port</Label>
                        <Input
                          id="smtp.port"
                          type="number"
                          {...register("smtp.port")}
                        />
                        {errors.smtp?.port && (
                          <p className="text-sm text-red-500">{errors.smtp.port.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp.username">Username</Label>
                        <Input
                          id="smtp.username"
                          placeholder="Your username"
                          {...register("smtp.username")}
                        />
                        {errors.smtp?.username && (
                          <p className="text-sm text-red-500">{errors.smtp.username.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp.password">Password</Label>
                        <Input
                          id="smtp.password"
                          type="password"
                          placeholder="Your password"
                          {...register("smtp.password")}
                        />
                        {errors.smtp?.password && (
                          <p className="text-sm text-red-500">{errors.smtp.password.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="smtp-tls" {...register("smtp.tls")} defaultChecked />
                      <Label htmlFor="smtp-tls">Use TLS/SSL</Label>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="space-y-2">
                  <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    min="1"
                    max="1440"
                    {...register("syncInterval")}
                  />
                  {errors.syncInterval && (
                    <p className="text-sm text-red-500">{errors.syncInterval.message}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div>
                  {selectedAccount && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDeleteAccount(selectedAccount)}
                      disabled={isLoading}
                    >
                      Delete Account
                    </Button>
                  )}
                </div>
                <div className="space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleNewAccount}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Account"}
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
