import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SmtpComposer } from './SmtpComposer';

interface SmtpComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
}

export function SmtpComposerModal({
  open,
  onOpenChange,
  accountId,
  defaultTo,
  defaultSubject,
  defaultBody,
}: SmtpComposerModalProps) {
  const handleSent = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Email</DialogTitle>
        </DialogHeader>
        <SmtpComposer
          accountId={accountId}
          defaultTo={defaultTo}
          defaultSubject={defaultSubject}
          defaultBody={defaultBody}
          onSent={handleSent}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage the composer modal state
export function useSmtpComposer(accountId: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultProps, setDefaultProps] = useState<{
    to?: string;
    subject?: string;
    body?: string;
  }>({});

  const openComposer = useCallback((props?: {
    to?: string;
    subject?: string;
    body?: string;
  }) => {
    if (props) {
      setDefaultProps(props);
    }
    setIsOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setIsOpen(false);
    setDefaultProps({});
  }, []);

  const ComposerModal = useCallback(() => (
    <SmtpComposerModal
      open={isOpen}
      onOpenChange={setIsOpen}
      accountId={accountId}
      defaultTo={defaultProps.to}
      defaultSubject={defaultProps.subject}
      defaultBody={defaultProps.body}
    />
  ), [isOpen, accountId, defaultProps]);

  return {
    openComposer,
    closeComposer,
    ComposerModal,
    isOpen,
  };
}
