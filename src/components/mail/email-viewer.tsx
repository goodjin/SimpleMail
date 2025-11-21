import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Star, 
  Reply, 
  ReplyAll, 
  Forward, 
  Archive, 
  Trash2, 
  MoreVertical,
  Download,
  Paperclip,
  Clock,
  User
} from 'lucide-react';
import { Mail as MailType, MailAttachment } from '@/types/mail';
import { cn } from '@/lib/utils';

interface EmailViewerProps {
  mail: MailType | null;
  onReply: (mail: MailType) => void;
  onReplyAll: (mail: MailType) => void;
  onForward: (mail: MailType) => void;
  onArchive: (mailId: string) => void;
  onDelete: (mailId: string) => void;
  onToggleStar: (mailId: string) => void;
  onMarkAsRead: (mailId: string) => void;
  onMarkAsUnread: (mailId: string) => void;
}

export function EmailViewer({
  mail,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onMarkAsRead,
  onMarkAsUnread
}: EmailViewerProps) {
  const [showFullHeaders, setShowFullHeaders] = useState(false);

  useEffect(() => {
    if (mail && !mail.read) {
      onMarkAsRead(mail.id);
    }
  }, [mail, onMarkAsRead]);

  if (!mail) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Mail className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>选择一封邮件查看详情</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    });
  };

  const renderEmailBody = () => {
    if (mail.htmlBody) {
      return (
        <div 
          className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-blockquote:text-muted-foreground prose-code:text-foreground"
          dangerouslySetInnerHTML={{ __html: mail.htmlBody }}
        />
      );
    }
    
    if (mail.body) {
      return (
        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
          {mail.body}
        </div>
      );
    }
    
    return <div className="text-muted-foreground italic">邮件内容为空</div>;
  };

  const handleDownloadAttachment = (attachment: MailAttachment) => {
    try {
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
    } catch (error) {
      console.error('Failed to download attachment:', error);
      alert('下载附件失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Email header */}
      <div className="border-b border-border">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleStar(mail.id)}
                className="h-8 w-8 p-0"
              >
                <Star 
                  className={cn(
                    "h-4 w-4",
                    mail.starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                  )}
                />
              </Button>
              
              <Badge variant={mail.read ? "secondary" : "default"}>
                {mail.read ? "已读" : "未读"}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => onArchive(mail.id)}>
                <Archive className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(mail.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <h1 className="text-xl font-semibold mb-4 text-foreground">
            {mail.subject || '(无主题)'}
          </h1>

          {/* Sender info */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{mail.from}</span>
                  {!mail.read && (
                    <div className="h-2 w-2 bg-blue-500 rounded-full" />
                  )}
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <div>收件人: {mail.to.join(', ')}</div>
                  {mail.cc && mail.cc.length > 0 && (
                    <div>抄送: {mail.cc.join(', ')}</div>
                  )}
                  {mail.bcc && mail.bcc.length > 0 && (
                    <div>密送: {mail.bcc.join(', ')}</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDate(mail.date)}
            </div>
          </div>
        </div>

        {/* Email actions */}
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onReply(mail)}>
            <Reply className="h-4 w-4 mr-2" />
            回复
          </Button>
          <Button variant="outline" size="sm" onClick={() => onReplyAll(mail)}>
            <ReplyAll className="h-4 w-4 mr-2" />
            全部回复
          </Button>
          <Button variant="outline" size="sm" onClick={() => onForward(mail)}>
            <Forward className="h-4 w-4 mr-2" />
            转发
          </Button>
          {!mail.read && (
            <Button variant="outline" size="sm" onClick={() => onMarkAsUnread(mail.id)}>
              标记为未读
            </Button>
          )}
        </div>
      </div>

      {/* Email body */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {renderEmailBody()}
          
          {/* Attachments */}
          {mail.attachments && mail.attachments.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <div className="flex items-center mb-4">
                <Paperclip className="h-4 w-4 mr-2" />
                <h3 className="font-medium text-foreground">
                  附件 ({mail.attachments.length})
                </h3>
              </div>
              
              <div className="grid gap-3">
                {mail.attachments.map((attachment, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground truncate">
                            {attachment.filename}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {attachment.contentType} • {formatFileSize(attachment.size)}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAttachment(attachment)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
