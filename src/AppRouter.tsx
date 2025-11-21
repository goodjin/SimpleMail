import { BrowserRouter as Router, Routes, Route, Outlet, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { AccountSettings } from '@/components/account/AccountSettings';
import { MailList } from '@/components/mail/mail-list';
import { MailDetail } from '@/components/mail/mail-detail';
import { ComposeEmail } from '@/components/mail/compose-email';
import { useMail } from '@/hooks/useMail';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Main app layout with sidebar and content area
function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      <MainLayout>
        <Routes>
          <Route path="/" element={<MailList folderId="inbox" onSelectMail={(mail) => {}} />} />
          <Route path="/mail/:mailId" element={<MailDetailWrapper />} />
          <Route 
            path="/compose" 
            element={
              <ComposeEmail 
                onClose={() => window.history.back()} 
                onSend={async () => {}} 
              />
            } 
          />
          <Route path="/settings/accounts" element={<AccountSettings />} />
          <Route path="/settings/accounts/:accountId" element={<AccountSettings />} />
        </Routes>
      </MainLayout>
    </div>
  );
}

// Wrapper component to handle mail detail with routing
function MailDetailWrapper() {
  const { mailId } = useParams<{ mailId: string }>();
  const { getMailById } = useMail();
  const mail = getMailById(mailId || '');

  if (!mail) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">邮件未找到</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回
        </Button>
      </div>
    );
  }

  return (
    <MailDetail 
      mail={mail}
      onBack={() => window.history.back()}
      onReply={() => {}}
      onForward={() => {}}
    />
  );
}

export function AppRouter() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}
