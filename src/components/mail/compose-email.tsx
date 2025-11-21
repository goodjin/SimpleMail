import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Paperclip, 
  X, 
  Bold, 
  Italic, 
  Underline, 
  Link, 
  Image
} from 'lucide-react';
import { Mail as MailType, MailAttachment } from '@/types/mail';
import { cn } from '@/lib/utils';

export interface ComposeEmailProps {
  replyTo?: MailType;
  forwardOf?: MailType;
  onClose: () => void;
  onSend: (email: {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments: MailAttachment[];
  }) => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

export function ComposeEmail({ 
  replyTo, 
  forwardOf, 
  onClose, 
  onSend, 
  initialTo = "", 
  initialSubject = "", 
  initialBody = "" 
}: ComposeEmailProps) {
  const [formData, setFormData] = useState({
    to: initialTo,
    cc: '',
    bcc: '',
    subject: initialSubject,
    body: initialBody,
    htmlBody: ''
  });
  
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) {
      setFormData(prev => ({
        ...prev,
        to: replyTo.from,
        subject: replyTo.subject ? `Re: ${replyTo.subject}` : '',
        body: `\n\n---\nOn ${new Date(replyTo.date).toLocaleString()}, ${replyTo.from} wrote:\n${replyTo.body || ''}`,
        htmlBody: replyTo.htmlBody ? `<br><br>---<br>On ${new Date(replyTo.date).toLocaleString()}, ${replyTo.from} wrote:<br>${replyTo.htmlBody}` : ''
      }));
    } else if (forwardOf) {
      setFormData(prev => ({
        ...prev,
        subject: forwardOf.subject ? `Fwd: ${forwardOf.subject}` : '',
        body: `\n\n--- Forwarded message ---\nFrom: ${forwardOf.from}\nDate: ${new Date(forwardOf.date).toLocaleString()}\nSubject: ${forwardOf.subject}\n\n${forwardOf.body || ''}`,
        htmlBody: forwardOf.htmlBody ? `<br><br>--- Forwarded message ---<br>From: ${forwardOf.from}<br>Date: ${new Date(forwardOf.date).toLocaleString()}<br>Subject: ${forwardOf.subject}<br><br>${forwardOf.htmlBody}` : ''
      }));
    }
  }, [replyTo, forwardOf]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.to.trim() || !formData.subject.trim() || !formData.body.trim()) {
      return;
    }

    setIsSending(true);
    try {
      await onSend({ 
        to: formData.to.split(',').map(addr => addr.trim()),
        cc: [],
        bcc: [],
        subject: formData.subject,
        body: formData.body,
        htmlBody: undefined,
        attachments: []
      });
      onClose();
    } catch (error) {
      console.error("Failed to send email:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">新邮件</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isSending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="to">收件人</Label>
              <Input
                id="to"
                value={formData.to}
                onChange={(e) => setFormData((prev: typeof formData) => ({ ...prev, to: e.target.value }))}
                placeholder="example@example.com"
                required
                disabled={isSending}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">主题</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData((prev: typeof formData) => ({ ...prev, subject: e.target.value }))}
                placeholder="输入主题"
                required
                disabled={isSending}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="body">内容</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData((prev: typeof formData) => ({ ...prev, body: e.target.value }))}
                placeholder="输入邮件内容..."
                rows={10}
                required
                disabled={isSending}
              />
            </div>
          </div>
          
          <div className="p-4 border-t flex justify-between items-center">
            <div>
              <Button type="button" variant="ghost" size="icon" disabled={isSending}>
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-x-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>
                取消
              </Button>
              <Button type="submit" disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}>
                {isSending ? (
                  <>
                    <span className="mr-2">发送中...</span>
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    发送
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
