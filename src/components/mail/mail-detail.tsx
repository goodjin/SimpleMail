import { Mail } from "@/types/mail";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Reply, ReplyAll, Forward, Archive, Trash2, Tag, MoreVertical } from "lucide-react";

interface MailDetailProps {
  mail: Mail | null;
  onBack: () => void;
  onReply: (mail: Mail) => void;
  onForward: (mail: Mail) => void;
}

export function MailDetail({ mail, onBack, onReply, onForward }: MailDetailProps) {
  if (!mail) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        选择一封邮件查看详情
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex space-x-2">
            <Button variant="ghost" size="icon">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <h1 className="text-xl font-semibold mb-4">{mail.subject}</h1>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
              {mail.from.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{mail.from}</div>
              <div className="text-xs text-muted-foreground">
                收件人: {mail.to.join(', ')}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {format(new Date(mail.date), 'yyyy年MM月dd日 HH:mm')}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: mail.body }} />
      </div>

      <div className="border-t border-border p-4 flex justify-between items-center">
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onReply(mail)}
          >
            <Reply className="mr-2 h-4 w-4" /> 回复
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onReply(mail)}
          >
            <ReplyAll className="mr-2 h-4 w-4" /> 全部回复
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onForward(mail)}
          >
            <Forward className="mr-2 h-4 w-4" /> 转发
          </Button>
        </div>
      </div>
    </div>
  );
}
