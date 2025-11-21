import { test, expect } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:1420',
  timeout: 30000,
  retry: 2,
};

// Test data
const TEST_ACCOUNT = {
  name: 'Test Account',
  email: 'test@example.com',
  imapServer: 'imap.example.com',
  imapPort: 993,
  smtpServer: 'smtp.example.com',
  smtpPort: 587,
  username: 'test@example.com',
  password: 'testpassword123',
};

const TEST_EMAIL = {
  to: 'recipient@example.com',
  subject: 'Test Email Subject',
  body: 'This is a test email sent via Playwright.',
};

test.describe('Tauri Mail Client E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONFIG.baseURL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Authentication', () => {
    test('should display login page', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Login');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.click('button[type="submit"]');
      
      await expect(page.locator('text=Email is required')).toBeVisible();
      await expect(page.locator('text=Password is required')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.fill('input[type="email"]', 'invalid@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      // Mock successful login (in real tests, this would connect to test server)
      await page.route('**/api/login', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, token: 'mock-token' }),
        });
      });

      await page.fill('input[type="email"]', TEST_ACCOUNT.email);
      await page.fill('input[type="password"]', TEST_ACCOUNT.password);
      await page.click('button[type="submit"]');
      
      // Should redirect to main app
      await page.waitForURL('**/mail');
      await expect(page.locator('text=Inbox')).toBeVisible();
    });
  });

  test.describe('Account Management', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      await page.waitForLoadState('networkidle');
    });

    test('should display account management page', async ({ page }) => {
      await page.click('button[aria-label="Settings"]');
      await page.click('text=Accounts');
      
      await expect(page.locator('h2')).toContainText('Email Accounts');
      await expect(page.locator('button:has-text("Add Account")')).toBeVisible();
    });

    test('should add new email account', async ({ page }) => {
      await page.click('button[aria-label="Settings"]');
      await page.click('text=Accounts');
      await page.click('button:has-text("Add Account")');
      
      // Fill account form
      await page.fill('input[name="name"]', TEST_ACCOUNT.name);
      await page.fill('input[name="email"]', TEST_ACCOUNT.email);
      await page.fill('input[name="imapServer"]', TEST_ACCOUNT.imapServer);
      await page.fill('input[name="imapPort"]', TEST_ACCOUNT.imapPort.toString());
      await page.fill('input[name="smtpServer"]', TEST_ACCOUNT.smtpServer);
      await page.fill('input[name="smtpPort"]', TEST_ACCOUNT.smtpPort.toString());
      await page.fill('input[name="username"]', TEST_ACCOUNT.username);
      await page.fill('input[name="password"]', TEST_ACCOUNT.password);
      
      // Mock account creation
      await page.route('**/api/accounts', (route) => {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ 
            id: 'test-account-1',
            ...TEST_ACCOUNT,
            createdAt: new Date().toISOString(),
          }),
        });
      });
      
      await page.click('button:has-text("Save Account")');
      
      await expect(page.locator('text=Account added successfully')).toBeVisible();
      await expect(page.locator(`text=${TEST_ACCOUNT.email}`)).toBeVisible();
    });

    test('should validate account form fields', async ({ page }) => {
      await page.click('button[aria-label="Settings"]');
      await page.click('text=Accounts');
      await page.click('button:has-text("Add Account")');
      
      // Try to submit empty form
      await page.click('button:has-text("Save Account")');
      
      await expect(page.locator('text=Account name is required')).toBeVisible();
      await expect(page.locator('text=Email is required')).toBeVisible();
      await expect(page.locator('text=IMAP server is required')).toBeVisible();
      await expect(page.locator('text=SMTP server is required')).toBeVisible();
    });
  });

  test.describe('Email Operations', () => {
    test.beforeEach(async ({ page }) => {
      // Setup authenticated session with test account
      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      await page.waitForLoadState('networkidle');
      
      // Mock email data
      await page.route('**/api/emails', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emails: [
              {
                id: 'email-1',
                from: 'sender@example.com',
                to: 'recipient@example.com',
                subject: 'Test Email 1',
                body: 'This is a test email.',
                date: '2023-01-01T10:00:00Z',
                read: false,
                starred: false,
                hasAttachments: false,
              },
              {
                id: 'email-2',
                from: 'sender2@example.com',
                to: 'recipient@example.com',
                subject: 'Test Email 2',
                body: 'This is another test email.',
                date: '2023-01-02T10:00:00Z',
                read: true,
                starred: true,
                hasAttachments: true,
              },
            ],
            totalCount: 2,
          }),
        });
      });
    });

    test('should display email list', async ({ page }) => {
      await expect(page.locator('text=Test Email 1')).toBeVisible();
      await expect(page.locator('text=Test Email 2')).toBeVisible();
      await expect(page.locator('text=sender@example.com')).toBeVisible();
      await expect(page.locator('text=sender2@example.com')).toBeVisible();
    });

    test('should select and view email', async ({ page }) => {
      await page.click('text=Test Email 1');
      
      await expect(page.locator('text=This is a test email.')).toBeVisible();
      await expect(page.locator('text=sender@example.com')).toBeVisible();
      await expect(page.locator('text=recipient@example.com')).toBeVisible();
    });

    test('should mark email as read', async ({ page }) => {
      await page.click('text=Test Email 1');
      
      // Mock mark as read API
      await page.route('**/api/emails/email-1/read', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });
      
      await page.click('button:has-text("Mark as Read")');
      
      await expect(page.locator('text=Email marked as read')).toBeVisible();
    });

    test('should star/unstar email', async ({ page }) => {
      await page.click('text=Test Email 1');
      
      // Mock star API
      await page.route('**/api/emails/email-1/star', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, starred: true }),
        });
      });
      
      await page.click('button:has-text("Star")');
      
      await expect(page.locator('button:has-text("Unstar")')).toBeVisible();
    });

    test('should delete email', async ({ page }) => {
      await page.click('text=Test Email 1');
      
      // Mock delete API
      await page.route('**/api/emails/email-1', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });
      
      await page.click('button:has-text("Delete")');
      await page.click('button:has-text("Confirm")');
      
      await expect(page.locator('text=Email deleted')).toBeVisible();
      await expect(page.locator('text=Test Email 1')).not.toBeVisible();
    });
  });

  test.describe('Email Composition', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      await page.waitForLoadState('networkidle');
    });

    test('should open compose dialog', async ({ page }) => {
      await page.click('button:has-text("Compose")');
      
      await expect(page.locator('h2:has-text("New Email")')).toBeVisible();
      await expect(page.locator('input[name="to"]')).toBeVisible();
      await expect(page.locator('input[name="subject"]')).toBeVisible();
      await expect(page.locator('textarea[name="body"]')).toBeVisible();
    });

    test('should send email', async ({ page }) => {
      await page.click('button:has-text("Compose")');
      
      // Fill email form
      await page.fill('input[name="to"]', TEST_EMAIL.to);
      await page.fill('input[name="subject"]', TEST_EMAIL.subject);
      await page.fill('textarea[name="body"]', TEST_EMAIL.body);
      
      // Mock send email API
      await page.route('**/api/send', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, messageId: 'msg-123' }),
        });
      });
      
      await page.click('button:has-text("Send")');
      
      await expect(page.locator('text=Email sent successfully')).toBeVisible();
    });

    test('should validate compose form', async ({ page }) => {
      await page.click('button:has-text("Compose")');
      
      // Try to send empty form
      await page.click('button:has-text("Send")');
      
      await expect(page.locator('text=Recipient is required')).toBeVisible();
      await expect(page.locator('text=Subject is required')).toBeVisible();
      await expect(page.locator('text=Body is required')).toBeVisible();
    });

    test('should handle attachments', async ({ page }) => {
      await page.click('button:has-text("Compose")');
      
      // Mock file upload
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('test-files/sample.txt');
      
      await expect(page.locator('text=sample.txt')).toBeVisible();
      
      // Mock attachment upload API
      await page.route('**/api/attachments', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            id: 'attachment-1',
            filename: 'sample.txt',
            size: 1024,
          }),
        });
      });
      
      await expect(page.locator('text=Attachment uploaded')).toBeVisible();
    });
  });

  test.describe('Search and Filter', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      await page.waitForLoadState('networkidle');
      
      // Mock search results
      await page.route('**/api/search', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emails: [
              {
                id: 'search-1',
                from: 'search@example.com',
                subject: 'Search Result Email',
                body: 'This email contains search terms.',
                date: '2023-01-01T10:00:00Z',
                read: false,
                starred: false,
                hasAttachments: false,
              },
            ],
            totalCount: 1,
            queryTime: 15,
          }),
        });
      });
    });

    test('should search emails', async ({ page }) => {
      await page.fill('input[placeholder*="Search"]', 'search terms');
      await page.click('button:has-text("Search")');
      
      await expect(page.locator('text=Search Result Email')).toBeVisible();
      await expect(page.locator('text=search@example.com')).toBeVisible();
    });

    test('should show search suggestions', async ({ page }) => {
      // Mock search suggestions
      await page.route('**/api/search/suggestions', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(['search@example.com', 'Search Result Email']),
        });
      });
      
      await page.fill('input[placeholder*="Search"]', 'search');
      
      await expect(page.locator('text=search@example.com')).toBeVisible();
      await expect(page.locator('text=Search Result Email')).toBeVisible();
    });

    test('should apply filters', async ({ page }) => {
      await page.click('button:has-text("Filters")');
      
      await page.click('input[name="hasAttachments"]');
      await page.click('input[name="isUnread"]');
      await page.click('button:has-text("Apply Filters")');
      
      // Mock filtered results
      await page.route('**/api/search', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emails: [],
            totalCount: 0,
            queryTime: 10,
          }),
        });
      });
      
      await expect(page.locator('text=No results found')).toBeVisible();
    });
  });

  test.describe('Performance Tests', () => {
    test('should load email list quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load in under 3 seconds
    });

    test('should handle large email lists efficiently', async ({ page }) => {
      // Mock large email list
      const largeEmailList = Array.from({ length: 1000 }, (_, i) => ({
        id: `email-${i}`,
        from: `sender${i}@example.com`,
        subject: `Email ${i}`,
        body: `Body of email ${i}`,
        date: '2023-01-01T10:00:00Z',
        read: i % 2 === 0,
        starred: i % 3 === 0,
        hasAttachments: i % 4 === 0,
      }));

      await page.route('**/api/emails', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emails: largeEmailList,
            totalCount: 1000,
          }),
        });
      });

      const startTime = Date.now();
      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      await page.waitForSelector('text=Email 1');
      
      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(2000); // Should render in under 2 seconds
    });

    test('should scroll smoothly through virtualized list', async ({ page }) => {
      // Mock virtualized scrolling
      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      await page.waitForLoadState('networkidle');
      
      const startTime = Date.now();
      
      // Scroll to bottom
      await page.evaluate(() => {
        const scrollContainer = document.querySelector('[data-testid="email-list"]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
      
      await page.waitForTimeout(500); // Wait for scroll to complete
      const scrollTime = Date.now() - startTime;
      
      expect(scrollTime).toBeLessThan(1000); // Should scroll smoothly
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network error
      await page.route('**/api/emails', (route) => {
        route.abort('failed');
      });

      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      
      await expect(page.locator('text=Failed to load emails')).toBeVisible();
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should handle server errors', async ({ page }) => {
      // Mock server error
      await page.route('**/api/emails', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      
      await expect(page.locator('text=Server error occurred')).toBeVisible();
    });

    test('should handle timeout errors', async ({ page }) => {
      // Mock timeout
      await page.route('**/api/emails', (route) => {
        // Don't respond to simulate timeout
        setTimeout(() => route.abort('failed'), 10000);
      });

      await page.goto(`${TEST_CONFIG.baseURL}/mail`);
      
      await expect(page.locator('text=Request timed out')).toBeVisible();
    });
  });
});
