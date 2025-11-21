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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const attachment: MailAttachment = {
            id: Date.now().toString() + Math.random(),
            filename: file.name,
            contentType: file.type,
            size: file.size,
            content: btoa(event.target.result as string)
          };
          setAttachments(prev => [...prev, attachment]);
        }
      };
      reader.readAsBinaryString(file);
    });
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const parseEmailAddresses = (addresses: string): string[] => {
    return addresses
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr && validateEmail(addr));
  };

  const handleSend = async () => {
    const to = parseEmailAddresses(formData.to);
    const cc = parseEmailAddresses(formData.cc);
    const bcc = parseEmailAddresses(formData.bcc);

    if (to.length === 0) {
      alert('请输入至少一个收件人邮箱地址');
      return;
    }

    if (!formData.subject.trim()) {
      alert('请输入邮件主题');
      return;
    }

    if (!formData.body.trim() && !formData.htmlBody.trim()) {
      alert('请输入邮件内容');
      return;
    }

    setIsSending(true);
    
    try {
      await onSend({
        to,
        cc,
        bcc,
        subject: formData.subject,
        body: formData.body,
        htmlBody: formData.htmlBody || undefined,
        attachments
      });
      onClose();
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('发送邮件失败，请重试');
    } finally {
      setIsSending(false);
    }
  };

  const insertFormatting = (tag: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const selectedText = formData.body.substring(start, end);
      
      let formattedText = '';
      switch (tag) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = `*${selectedText}*`;
          break;
        case 'underline':
          formattedText = `__${selectedText}__`;
          break;
        case 'link':
          formattedText = `[${selectedText || '链接文本'}](URL)`;
          break;
        default:
          formattedText = selectedText;
      }
      
      const newBody = formData.body.substring(0, start) + formattedText + formData.body.substring(end);
      setFormData(prev => ({ ...prev, body: newBody }));
      
      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
        }
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {replyTo ? '回复邮件' : forwardOf ? '转发邮件' : '撰写新邮件'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSending}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          <div className="space-y-4">
            {/* Recipients */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="to">收件人</Label>
                <Input
                  id="to"
                  placeholder="输入邮箱地址，多个地址用逗号分隔"
                  value={formData.to}
                  onChange={(e) => handleInputChange('to', e.target.value)}
                  disabled={isSending}
                />
              </div>

              {showCcBcc && (
                <>
                  <div>
                    <Label htmlFor="cc">抄送</Label>
                    <Input
                      id="cc"
                      placeholder="输入抄送邮箱地址"
                      value={formData.cc}
                      onChange={(e) => handleInputChange('cc', e.target.value)}
                      disabled={isSending}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bcc">密送</Label>
                    <Input
                      id="bcc"
                      placeholder="输入密送邮箱地址"
                      value={formData.bcc}
                      onChange={(e) => handleInputChange('bcc', e.target.value)}
                      disabled={isSending}
                    />
                  </div>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCcBcc(!showCcBcc)}
                disabled={isSending}
              >
                {showCcBcc ? '隐藏' : '显示'}抄送/密送
              </Button>
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="subject">主题</Label>
              <Input
                id="subject"
                placeholder="输入邮件主题"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                disabled={isSending}
              />
            </div>

            {/* Email body */}
            <div>
              <Label>邮件内容</Label>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                </TabsList>
                
                <TabsContent value="edit" className="space-y-3">
                  {/* Formatting toolbar */}
                  <div className="flex items-center gap-1 p-2 border border-border rounded-md bg-muted/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => insertFormatting('bold')}
                      title="粗体"
                      disabled={isSending}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => insertFormatting('italic')}
                      title="斜体"
                      disabled={isSending}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => insertFormatting('underline')}
                      title="下划线"
                      disabled={isSending}
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => insertFormatting('link')}
                      title="链接"
                      disabled={isSending}
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="图片"
                      disabled={isSending}
                    >
                      <Image className="h-4 w-4" />
                    </Button>
                  </div>

                  <Textarea
                    ref={textareaRef}
                    placeholder="输入邮件内容..."
                    value={formData.body}
                    onChange={(e) => handleInputChange('body', e.target.value)}
                    className="min-h-[200px] resize-none"
                    disabled={isSending}
                  />
                </TabsContent>
                
                <TabsContent value="preview">
                  <div className="min-h-[200px] p-4 border border-border rounded-md bg-muted/30">
                    {formData.body ? (
                      <div className="whitespace-pre-wrap">{formData.body}</div>
                    ) : (
                      <div className="text-muted-foreground italic">预览内容将在这里显示</div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>附件</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  添加附件
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isSending}
                />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-2 border border-border rounded-md bg-muted/30"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{attachment.filename}</span>
                        <Badge variant="secondary" className="text-xs">
                          {formatFileSize(attachment.size)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(attachment.id)}
                        disabled={isSending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>

        {/* Actions */}
        <div className="p-4 border-t border-border">
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              取消
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" disabled={isSending}>
                保存草稿
              </Button>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    发送中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    发送
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
