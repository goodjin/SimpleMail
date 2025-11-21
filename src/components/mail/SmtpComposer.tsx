import { useState, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Paperclip, X, Send } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { smtpService, type EmailAttachment } from '@/services/smtpService';

interface SmtpComposerProps {
  accountId: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSent?: () => void;
  onCancel?: () => void;
}

export function SmtpComposer({
  accountId,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  onSent,
  onCancel,
}: SmtpComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [isHtml, setIsHtml] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!to.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter at least one recipient',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSending(true);
      
      // Convert files to attachments
      const emailAttachments = await Promise.all(
        attachments.map(file => smtpService.fileToAttachment(file))
      );

      // Split and clean email addresses
      const toEmails = to.split(/[,\s]+/).filter(Boolean);
      const ccEmails = cc ? cc.split(/[,\s]+/).filter(Boolean) : [];
      const bccEmails = bcc ? bcc.split(/[,\s]+/).filter(Boolean) : [];

      await smtpService.sendEmail({
        accountId,
        to: toEmails,
        subject: subject || '(No subject)',
        body: isHtml ? 'This email contains HTML content. Please use an HTML email client to view it.' : body,
        htmlBody: isHtml ? body : undefined,
        cc: ccEmails.length ? ccEmails : undefined,
        bcc: bccEmails.length ? bccEmails : undefined,
        attachments: emailAttachments.length ? emailAttachments : undefined,
      });

      toast({
        title: 'Success',
        description: 'Email sent successfully',
      });

      if (onSent) onSent();
    } catch (error) {
      console.error('Failed to send email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label htmlFor="to" className="w-12 text-right">
            To:
          </Label>
          <Input
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1"
            required
          />
        </div>

        {showCc ? (
          <div className="flex items-center space-x-2">
            <Label htmlFor="cc" className="w-12 text-right">
              Cc:
            </Label>
            <Input
              id="cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="flex-1"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCc(true)}
            className="text-xs text-muted-foreground hover:underline ml-14"
          >
            + Cc
          </button>
        )}

        {showBcc ? (
          <div className="flex items-center space-x-2">
            <Label htmlFor="bcc" className="w-12 text-right">
              Bcc:
            </Label>
            <Input
              id="bcc"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="bcc@example.com"
              className="flex-1"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowBcc(true)}
            className="text-xs text-muted-foreground hover:underline ml-14"
          >
            + Bcc
          </button>
        )}

        <div className="flex items-center space-x-2">
          <Label htmlFor="subject" className="w-12 text-right">
            Subject:
          </Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach file</span>
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />
          <div className="flex items-center space-x-2">
            <Switch
              id="html-mode"
              checked={isHtml}
              onCheckedChange={setIsHtml}
            />
            <Label htmlFor="html-mode" className="text-sm">
              HTML
            </Label>
          </div>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-muted rounded-md"
            >
              <div className="flex-1 truncate">{file.name}</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeAttachment(index)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove attachment</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md">
        {isHtml ? (
          <div
            className="min-h-[400px] p-4 focus:outline-none"
            contentEditable
            onInput={(e) => setBody(e.currentTarget.innerHTML)}
            dangerouslySetInnerHTML={{ __html: body || '<p>Compose your email here...</p>' }}
            className="min-h-[400px] p-4 focus:outline-none"
          />
        ) : (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Compose your email here..."
            className="min-h-[400px] border-0 focus-visible:ring-0"
          />
        )}
      </div>

      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSending}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSending}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
