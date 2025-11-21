import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import * as mailService from '@/services/mailService';
import { useToast } from '@/contexts/toast-context';
import { validateEmails } from '@/lib/email-utils';
import type { Mail, MailFolder, NewMail, MailAttachment } from '@/types/mail';

interface SendMailParams {
  to: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string;
  }>;
  inReplyTo?: string;
  references?: string[];
}

export function useMails(accountId: string, folderId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch folders
  const { data: folders = [], isLoading: isLoadingFolders } = useQuery<MailFolder[]>({
    queryKey: ['mailFolders', accountId],
    queryFn: () => mailService.getFolders(accountId),
    enabled: !!accountId,
  });

  // Fetch mails for the current folder
  const { 
    data: mailData = { mails: [], total: 0 }, 
    isLoading: isLoadingMails,
    refetch: refetchMails 
  } = useQuery({
    queryKey: ['mails', accountId, folderId],
    queryFn: () => mailService.getMails(accountId, folderId),
    enabled: !!accountId && !!folderId,
    select: (data: { mails: Mail[]; total: number }) => ({
      ...data,
      // Sort by date, newest first
      mails: [...data.mails].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    }),
  });

  // Send email
  const sendMailMutation = useMutation({
    mutationFn: async (params: SendMailParams) => {
      // Validate email addresses
      const toValidation = validateEmails(params.to.join(','));
      if (!toValidation.valid) {
        throw new Error(`Invalid email addresses: ${toValidation.invalidEmails.join(', ')}`);
      }

      // Format email addresses
      const formattedParams = {
        ...params,
        to: params.to.join(','),
        cc: params.cc ? params.cc.join(',') : undefined,
        bcc: params.bcc ? params.bcc.join(',') : undefined,
      };

      return mailService.sendMail(formattedParams, accountId);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['mails', accountId, 'sent'] });
      toast({
        title: 'Success',
        description: 'Email sent successfully',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to send email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send email',
        variant: 'destructive',
      });
    },
  });

  const sendMail = async (params: Omit<SendMailParams, 'folderId'>) => {
    // Format the email data for the mail service
    const emailData: NewMail = {
      to: params.to,
      subject: params.subject,
      body: params.body,
      htmlBody: params.htmlBody,
      cc: params.cc,
      bcc: params.bcc,
      attachments: params.attachments?.map((att, index) => ({
        id: `att-${index}`,
        filename: att.filename,
        contentType: att.contentType,
        size: att.content.length,
        content: att.content,
      })),
      inReplyTo: params.inReplyTo,
      references: params.references,
      folderId: 'sent',
      accountId,
    };

    return sendMailMutation.mutateAsync(params);
  };

  // Toggle star status
  const toggleStarMutation = useMutation({
    mutationFn: async ({ ids, starred }: { ids: string[]; starred: boolean }) => {
      return mailService.updateMails(accountId, ids, { starred });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails', accountId, folderId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update emails',
        variant: 'destructive',
      });
    },
  }) as UseMutationResult<void, Error, { ids: string[]; starred: boolean }>;

  // Mark as read/unread
  const markReadMutation = useMutation({
    mutationFn: async ({ ids, read }: { ids: string[]; read: boolean }) => {
      return mailService.updateMails(accountId, ids, { read });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails', accountId, folderId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update emails',
        variant: 'destructive',
      });
    },
  });

  // Delete emails
  const deleteMailsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return mailService.deleteMails(accountId, ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails', accountId, folderId] });
      toast({
        title: 'Success',
        description: 'Emails deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete emails',
        variant: 'destructive',
      });
    },
  });

  const syncAccount = useMutation({
    mutationFn: async () => {
      return mailService.syncAccount(accountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails', accountId] });
      queryClient.invalidateQueries({ queryKey: ['mailFolders', accountId] });
      toast({
        title: 'Success',
        description: 'Account synced successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync account',
        variant: 'destructive',
      });
    },
  });

  const [selectedMails, setSelectedMails] = useState<string[]>([]);

  const toggleSelectMail = (mailId: string) => {
    setSelectedMails(prev => 
      prev.includes(mailId) 
        ? prev.filter(id => id !== mailId)
        : [...prev, mailId]
    );
  };

  const selectAllMails = (select: boolean) => {
    if (select) {
      setSelectedMails(mailData.mails.map(mail => mail.id));
    } else {
      setSelectedMails([]);
    }
  };

  const markSelectedAsRead = useCallback(() => {
    if (selectedMails.length > 0) {
      markReadMutation.mutate({ ids: selectedMails, read: true });
    }
  }, [selectedMails, markReadMutation]);

  const markSelectedAsUnread = useCallback(() => {
    if (selectedMails.length > 0) {
      markReadMutation.mutate({ ids: selectedMails, read: false });
    }
  }, [selectedMails, markReadMutation]);

  const toggleStarSelected = useCallback(
    (starred: boolean) => {
      if (selectedMails.length > 0) {
        toggleStarMutation.mutate({ ids: selectedMails, starred });
      }
    },
    [selectedMails, toggleStarMutation]
  );

  const moveSelectedToFolder = useCallback(
    (folderId: string) => {
      if (selectedMails.length > 0) {
        // TODO: Implement move functionality
        console.log('Moving mails to folder:', folderId);
      }
    },
    [selectedMails]
  );

  const deleteSelected = useCallback(() => {
    if (selectedMails.length > 0) {
      deleteMailsMutation.mutate(selectedMails);
      setSelectedMails([]);
    }
  }, [selectedMails, deleteMailsMutation]);

  const getMailById = useCallback(
    (mailId: string): Mail | undefined => {
      return mailData.mails.find(mail => mail.id === mailId);
    },
    [mailData.mails]
  );

  return {
    // Data
    mails: mailData.mails,
    totalMails: mailData.total,
    folders,
    selectedMails,
    
    // Loading states
    isLoadingFolders,
    isLoadingMails,
    
    // Actions
    sendMail,
    toggleStar: (mailId: string, starred: boolean) => 
      toggleStarMutation.mutate({ ids: [mailId], starred }),
    markAsRead: (mailId: string, read: boolean) => 
      markReadMutation.mutate({ ids: [mailId], read }),
    deleteMails: (ids: string[]) => deleteMailsMutation.mutate(ids),
    refetchMails,
    
    // Selection actions
    toggleSelectMail,
    selectAllMails,
    markSelectedAsRead,
    markSelectedAsUnread,
    toggleStarSelected,
    moveSelectedToFolder,
    deleteSelected,
    
    // Utilities
    syncAccount,
    getMailById,
  };
}
