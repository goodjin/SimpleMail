import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Paperclip, Send, Trash2 } from 'lucide-react';
import { useMails } from '@/hooks/useMails';
import { useToast } from '@/contexts/toast-context';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { draftService } from '@/services/draftService';
import { format } from 'date-fns';

type Attachment = {
  id: string;
  file: File;
  size: string;
};

interface ComposeMailProps {
  onClose: () => void;
  replyTo?: {
    from: string;
    subject: string;
    body: string;
  };
}

export function ComposeMail({ onClose, replyTo, initialDraftId }: ComposeMailProps & { initialDraftId?: string }) {
  const [to, setTo] = useState(replyTo?.from || '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState(replyTo ? `\n\n-------- Original Message --------\nFrom: ${replyTo.from}\n${replyTo.body}` : '');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
  const { sendMail } = useMails('default', 'drafts');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveRef = useRef<{ trigger: (onSave?: (draft: any) => void) => void; cancel: () => void }>();

  // Load draft if initialDraftId is provided
  useEffect(() => {
    const loadDraft = async () => {
      if (!initialDraftId) return;
      
      try {
        const draft = await draftService.getDraft(initialDraftId);
        if (draft) {
          setTo(draft.to?.join(', ') || '');
          setSubject(draft.subject || '');
          setBody(draft.body || '');
          setDraftId(draft.draftId);
          setLastSaved(new Date(draft.lastSaved || ''));
          // Note: You might need to handle attachments here as well
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
        toast({
          title: 'Error',
          description: 'Failed to load draft',
          variant: 'destructive',
        });
      }
    };
    
    loadDraft();
  }, [initialDraftId, toast]);

  // Auto-save draft when content changes
  useEffect(() => {
    if (!to && !subject && !body && (!attachments || attachments.length === 0)) {
      return;
    }

    if (!draftService) return;
    
    autoSaveRef.current = draftService.createAutoSave({
      draftId,
      to: to.split(',').map(e => e.trim()).filter(Boolean),
      subject,
      body,
      attachments: attachments.map(a => ({
        id: a.id,
        filename: a.file.name,
        contentType: a.file.type || 'application/octet-stream',
        size: a.file.size,
        content: '' // Will be populated when sending
      }))
    });

    autoSaveRef.current.trigger((savedDraft) => {
      setDraftId(savedDraft.draftId);
      setLastSaved(new Date(savedDraft.lastSaved));
      setIsSaving(true);
      
      // Show a brief saving indicator
      setTimeout(() => setIsSaving(false), 1000);
    });

    return () => {
      if (autoSaveRef.current) {
        autoSaveRef.current.cancel();
      }
    };
  }, [to, subject, body, attachments, draftId]);

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      const savedDraft = await draftService.saveDraft({
        draftId,
        to: to.split(',').map(e => e.trim()).filter(Boolean),
        subject,
        body,
        attachments: attachments.map(a => ({
          id: a.id,
          filename: a.file.name,
          contentType: a.file.type || 'application/octet-stream',
          size: a.file.size,
          content: '' // Content will be populated when sending
 })),
        from: 'me@example.com' // Should come from user settings
      });
      
      setDraftId(savedDraft.draftId);
      setLastSaved(new Date(savedDraft.lastSaved));
      
      toast({
        title: 'Draft saved',
        description: 'Your draft has been saved.',
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to save draft. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!to || !subject || !body) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSending(true);
      
      // Convert attachments to the format expected by the mail service
      const mailAttachments = await Promise.all(
        attachments.map(async (attachment) => {
          const content = await readFileAsBase64(attachment.file);
          return {
            id: attachment.id,
            filename: attachment.file.name,
            contentType: attachment.file.type || 'application/octet-stream',
            size: attachment.file.size,
            content: content.split(',')[1], // Remove the data URL prefix
          };
        })
      );
      
      await sendMail({
        to: to.split(',').map(email => email.trim().toLowerCase()),
        subject,
        body,
        htmlBody: body, // For rich text emails, you might want to convert markdown to HTML
        attachments: mailAttachments,
        folderId: 'sent',
      });
      
      // Delete draft after sending
      if (draftId) {
        await draftService.deleteDraft(draftId);
      }
      
      toast({
        title: 'Success',
        description: 'Email sent successfully',
      });
      
      onClose();
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
  
  const handleAttachFile = (file: File) => {
    setAttachments((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        file,
        size: formatFileSize(file.size),
      },
    ]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(handleAttachFile);
    
    // Reset the input value to allow selecting the same file again
    if (e.target) {
      e.target.value = '';
    }
  };
  
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };
  
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {replyTo ? 'Reply' : 'New Message'}
          </h2>
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
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                required
                disabled={isSending}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                required
                disabled={isSending}
              />
            </div>
            
            <div className="grid gap-2 flex-1">
              <Label htmlFor="body" className="sr-only">
                Message
              </Label>
              <RichTextEditor
                content={body}
                onChange={setBody}
                placeholder="Write your message here..."
                onAttach={handleAttachFile}
                className="min-h-[300px]"
              />
              
              {attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {attachments.map((attachment) => (
                    <div 
                      key={attachment.id}
                      className="flex items-center justify-between p-2 border rounded-md bg-muted/20"
                    >
                      <div className="flex items-center space-x-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-xs">
                          {attachment.file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {attachment.size}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeAttachment(attachment.id)}
                        disabled={isSending}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="sr-only">Remove attachment</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-2 border-t flex items-center justify-between text-xs text-muted-foreground">
            {lastSaved && (
              <div className="text-xs text-muted-foreground">
                {isSaving ? 'Saving...' : `Draft saved ${format(new Date(lastSaved), 'MMM d, yyyy h:mm a')}`}
              </div>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                className="hidden"
                multiple
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="icon"
                onClick={handleFileButtonClick}
                disabled={isSending}
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach file</span>
              </Button>
            </div>
            
            <div className="space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSending}
              >
                Discard
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleSaveDraft}
                disabled={isSending || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button type="submit" disabled={isSending}>
                {isSending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send
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
