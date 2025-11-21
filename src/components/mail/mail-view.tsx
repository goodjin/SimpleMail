import { useState } from 'react';
import { Mail } from '@/types/mail';
import { MailList } from './mail-list';
import { MailDetail } from './mail-detail';
import { cn } from '@/lib/utils';

export function MailView() {
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  const handleSelectMail = (mail: Mail) => {
    setSelectedMail(mail);
    setShowMobileDetail(true);
  };

  const handleBackToList = () => {
    setShowMobileDetail(false);
  };

  const handleReply = (mail: Mail) => {
    // TODO: Implement reply functionality
    console.log('Replying to:', mail);
  };

  const handleForward = (mail: Mail) => {
    // TODO: Implement forward functionality
    console.log('Forwarding:', mail);
  };

  const handleFolderChange = (folderId: string) => {
    setCurrentFolder(folderId);
    setSelectedMail(null);
    setShowMobileDetail(false);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Mail List - hidden on mobile when detail is shown */}
      <div 
        className={cn(
          'flex-1 flex flex-col border-r border-border',
          'md:flex md:w-1/3 lg:w-1/4',
          showMobileDetail ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-semibold">
            {currentFolder === 'inbox' && '收件箱'}
            {currentFolder === 'sent' && '已发送'}
            {currentFolder === 'drafts' && '草稿箱'}
            {currentFolder === 'trash' && '回收站'}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MailList 
            folderId={currentFolder}
            onSelectMail={handleSelectMail}
            selectedMailId={selectedMail?.id}
          />
        </div>
      </div>

      {/* Mail Detail - full width on mobile when selected, otherwise hidden */}
      <div 
        className={cn(
          'flex-1 flex-col',
          showMobileDetail ? 'flex' : 'hidden md:flex',
          !selectedMail && 'items-center justify-center'
        )}
      >
        {selectedMail ? (
          <MailDetail
            mail={selectedMail}
            onBack={handleBackToList}
            onReply={handleReply}
            onForward={handleForward}
          />
        ) : (
          <div className="text-muted-foreground p-4 text-center">
            选择一封邮件查看详情
          </div>
        )}
      </div>
    </div>
  );
}
