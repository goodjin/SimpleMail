import { useState, useEffect } from "react";
import { Mail } from "@/types/mail";
import { mailService } from "@/services/mailService";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

interface MailListProps {
  folderId: string;
  onSelectMail: (mail: Mail) => void;
  selectedMailId?: string;
}

export function MailList({ folderId, onSelectMail, selectedMailId }: MailListProps) {
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMails = async () => {
      setLoading(true);
      try {
        const data = await mailService.getMails(folderId);
        setMails(data);
      } catch (error) {
        console.error('Failed to load mails:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMails();
  }, [folderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (mails.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        没有邮件
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {mails.map((mail) => (
        <div
          key={mail.id}
          className={cn(
            "p-4 hover:bg-accent/50 cursor-pointer transition-colors",
            selectedMailId === mail.id ? "bg-accent/30" : "",
            !mail.read ? "font-semibold" : ""
          )}
          onClick={() => onSelectMail(mail)}
        >
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-sm truncate">{mail.from}</h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
              {format(new Date(mail.date), 'MMM d')}
            </span>
          </div>
          <h4 className="text-sm truncate">{mail.subject}</h4>
          <p className="text-xs text-muted-foreground truncate mt-1">
            {mail.body.substring(0, 100)}{mail.body.length > 100 ? '...' : ''}
          </p>
          <div className="flex mt-2 gap-2">
            {mail.labels.map((label) => (
              <span 
                key={label} 
                className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
