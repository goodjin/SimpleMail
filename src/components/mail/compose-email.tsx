import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Paperclip, Send } from "lucide-react";

export interface ComposeEmailProps {
  onClose: () => void;
  onSend: (email: { to: string; subject: string; body: string }) => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

export function ComposeEmail({
  onClose,
  onSend,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
}: ComposeEmailProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) {
      return;
    }

    setIsSending(true);
    try {
      await onSend({ to, subject, body });
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
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="example@example.com"
                required
                disabled={isSending}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">主题</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="邮件主题"
                required
                disabled={isSending}
              />
            </div>
            
            <div className="space-y-2 flex-1 flex flex-col">
              <Label htmlFor="body">内容</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="flex-1 min-h-[200px]"
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
