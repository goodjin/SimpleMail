import { invoke } from '@tauri-apps/api/tauri';

export interface SmtpConfig {
  accountId: string;
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  from: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

export interface SendEmailParams {
  accountId: string;
  to: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export const smtpService = {
  /**
   * Connect to an SMTP server
   */
  async connect(config: SmtpConfig): Promise<void> {
    await invoke('smtp_connect', {
      config: {
        account_id: config.accountId,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        use_tls: config.useTls,
        from: config.from,
      },
    });
  },

  /**
   * Disconnect from an SMTP server
   */
  async disconnect(accountId: string): Promise<boolean> {
    return await invoke('smtp_disconnect', { accountId });
  },

  /**
   * Send an email
   */
  async sendEmail(params: SendEmailParams): Promise<void> {
    // Convert Uint8Array to number[] for serialization
    const attachments = params.attachments?.map(attachment => ({
      filename: attachment.filename,
      content_type: attachment.contentType,
      content: Array.from(attachment.content),
    }));

    await invoke('smtp_send_email', {
      params: {
        account_id: params.accountId,
        to: params.to,
        subject: params.subject,
        body: params.body,
        html_body: params.htmlBody,
        cc: params.cc,
        bcc: params.bcc,
        attachments,
      },
    });
  },

  /**
   * Test SMTP connection
   */
  async testConnection(config: Omit<SmtpConfig, 'accountId'> & { accountId?: string }): Promise<boolean> {
    try {
      await invoke('smtp_test_connection', {
        config: {
          account_id: config.accountId || 'test',
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          use_tls: config.useTls,
          from: config.from,
        },
      });
      return true;
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return false;
    }
  },

  /**
   * Convert a File object to an EmailAttachment
   */
  async fileToAttachment(file: File): Promise<EmailAttachment> {
    const arrayBuffer = await file.arrayBuffer();
    return {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      content: new Uint8Array(arrayBuffer),
    };
  },

  /**
   * Send a test email
   */
  async sendTestEmail(config: SmtpConfig, to: string): Promise<boolean> {
    try {
      await this.connect(config);
      
      const testEmail: SendEmailParams = {
        accountId: config.accountId,
        to: [to],
        subject: 'Test Email from Tauri Mail Client',
        body: 'This is a test email sent from the Tauri Mail Client.',
        htmlBody: `
          <h1>Test Email</h1>
          <p>This is a test email sent from the <strong>Tauri Mail Client</strong>.</p>
          <p>If you're reading this, your SMTP configuration is working correctly! 🎉</p>
        `,
      };

      await this.sendEmail(testEmail);
      return true;
    } catch (error) {
      console.error('Failed to send test email:', error);
      throw error;
    } finally {
      await this.disconnect(config.accountId);
    }
  },
};
