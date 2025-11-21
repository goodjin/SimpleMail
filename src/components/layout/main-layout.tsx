import { ReactNode } from "react";
import { Mail, MailFolder } from "@/types/mail";
import { mailService } from "@/services/mailService";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Inbox, Send, FileText, Trash2, AlertCircle } from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

const getFolderIcon = (folderId: string) => {
  switch (folderId) {
    case 'inbox':
      return <Inbox className="h-4 w-4 mr-3" />;
    case 'sent':
      return <Send className="h-4 w-4 mr-3" />;
    case 'drafts':
      return <FileText className="h-4 w-4 mr-3" />;
    case 'trash':
      return <Trash2 className="h-4 w-4 mr-3" />;
    case 'spam':
      return <AlertCircle className="h-4 w-4 mr-3" />;
    default:
      return <FileText className="h-4 w-4 mr-3" />;
  }
};

export function MainLayout({ children }: MainLayoutProps) {
  const { data: folders } = useQuery<MailFolder[]>({
    queryKey: ['mailFolders'],
    queryFn: () => mailService.getFolders(),
    initialData: [
      { id: 'inbox', name: '收件箱', icon: 'inbox', count: 3 },
      { id: 'sent', name: '已发送', icon: 'send' },
      { id: 'drafts', name: '草稿', icon: 'file-text' },
      { id: 'trash', name: '垃圾箱', icon: 'trash' },
      { id: 'spam', name: '垃圾邮件', icon: 'alert-circle' },
    ],
  });

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold">邮件客户端</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {folders?.map((folder) => (
              <li key={folder.id}>
                <button
                  className={cn(
                    "w-full flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  {getFolderIcon(folder.id)}
                  <span>{folder.name}</span>
                  {folder.count && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {folder.count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            v0.1.0
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
