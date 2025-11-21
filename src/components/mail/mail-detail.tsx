import { Mail, MailAttachment } from "@/types/mail";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Reply, ReplyAll, Forward, Archive, Trash2, MoreVertical, Download, Paperclip } from "lucide-react";

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

  const renderEmailBody = () => {
    if (mail.htmlBody) {
      return (
        <div 
          className="prose max-w-none" 
          dangerouslySetInnerHTML={{ __html: mail.htmlBody }}
        />
      );
    }
    return (
      <div className="whitespace-pre-wrap font-mono text-sm">
        {mail.body}
      </div>
    );
  };

  const handleDownloadAttachment = (attachment: MailAttachment) => {
    // Convert base64 to blob and download
    const byteCharacters = atob(attachment.content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: attachment.contentType });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

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
                {mail.cc && mail.cc.length > 0 && (
                  <span> | 抄送: {mail.cc.join(', ')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {format(new Date(mail.date), 'yyyy年MM月dd日 HH:mm')}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {renderEmailBody()}
        
        {/* Attachments */}
        {mail.attachments && mail.attachments.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center mb-3">
              <Paperclip className="h-4 w-4 mr-2" />
              <span className="font-medium">附件 ({mail.attachments.length})</span>
            </div>
            <div className="space-y-2">
              {mail.attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{attachment.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(attachment.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadAttachment(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
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
