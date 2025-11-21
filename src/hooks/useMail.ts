import { useState, useCallback } from 'react';
import { Mail } from '@/types/mail';

export function useMail() {
  const [mails, setMails] = useState<Mail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get a single mail by ID
  const getMailById = useCallback((id: string): Mail | undefined => {
    return mails.find(mail => mail.id === id);
  }, [mails]);

  // Fetch mails for a specific folder
  const fetchMails = useCallback(async (folderId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      // const response = await mailService.getMails(folderId);
      // setMails(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch mails'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send a new email
  const sendMail = useCallback(async (mail: Omit<Mail, 'id' | 'date' | 'read'>) => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      // const response = await mailService.sendMail(mail);
      // return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send mail'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark a mail as read
  const markAsRead = useCallback(async (mailId: string) => {
    try {
      setMails(prevMails =>
        prevMails.map(mail =>
          mail.id === mailId ? { ...mail, read: true } : mail
        )
      );
      // TODO: Replace with actual API call
      // await mailService.markAsRead(mailId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to mark mail as read'));
    }
  }, []);

  return {
    mails,
    isLoading,
    error,
    getMailById,
    fetchMails,
    sendMail,
    markAsRead,
  };
}
