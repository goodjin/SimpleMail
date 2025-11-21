import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchBar } from '../src/components/mail/search';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('SearchBar Component', () => {
  const mockOnSearch = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input correctly', () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        onClear={mockOnClear}
        placeholder="Search emails..."
      />
    );

    expect(screen.getByPlaceholderText('Search emails...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onSearch when form is submitted', async () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        onClear={mockOnClear}
        placeholder="Search emails..."
      />
    );

    const input = screen.getByPlaceholderText('Search emails...');
    const button = screen.getByRole('button');

    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith({ query: 'test query' });
    });
  });

  it('calls onClear when clear button is clicked', () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        onClear={mockOnClear}
        placeholder="Search emails..."
      />
    );

    const input = screen.getByPlaceholderText('Search emails...');
    const clearButton = screen.getByLabelText('Clear search');

    // First enter some text
    fireEvent.change(input, { target: { value: 'test' } });

    // Then click clear
    fireEvent.click(clearButton);

    expect(mockOnClear).toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('shows suggestions when available', async () => {
    const suggestions = ['test email', 'test subject', 'another test'];
    
    render(
      <SearchBar
        onSearch={mockOnSearch}
        onClear={mockOnClear}
        suggestions={suggestions}
        placeholder="Search emails..."
      />
    );

    const input = screen.getByPlaceholderText('Search emails...');
    
    // Focus and type to trigger suggestions
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('test email')).toBeInTheDocument();
      expect(screen.getByText('test subject')).toBeInTheDocument();
    });
  });

  it('filters suggestions based on input', async () => {
    const suggestions = ['test email', 'different subject', 'another test'];
    
    render(
      <SearchBar
        onSearch={mockOnSearch}
        onClear={mockOnClear}
        suggestions={suggestions}
        placeholder="Search emails..."
      />
    );

    const input = screen.getByPlaceholderText('Search emails...');
    
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('test email')).toBeInTheDocument();
      expect(screen.getByText('another test')).toBeInTheDocument();
      expect(screen.queryByText('different subject')).not.toBeInTheDocument();
    });
  });
});

describe('Email List Component', () => {
  it('renders email list correctly', () => {
    const mockEmails = [
      {
        id: '1',
        from: 'sender@example.com',
        subject: 'Test Email',
        body: 'Test body',
        date: '2023-01-01T00:00:00Z',
        read: false,
        starred: false,
        hasAttachments: false,
      },
      {
        id: '2',
        from: 'sender2@example.com',
        subject: 'Another Email',
        body: 'Another body',
        date: '2023-01-02T00:00:00Z',
        read: true,
        starred: true,
        hasAttachments: true,
      },
    ];

    const mockOnSelect = vi.fn();

    render(
      <VirtualizedEmailList
        mails={mockEmails}
        selectedMailIds={new Set()}
        onSelectMail={mockOnSelect}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onToggleSelect={vi.fn()}
      />
    );

    expect(screen.getByText('sender@example.com')).toBeInTheDocument();
    expect(screen.getByText('Test Email')).toBeInTheDocument();
    expect(screen.getByText('sender2@example.com')).toBeInTheDocument();
    expect(screen.getByText('Another Email')).toBeInTheDocument();
  });

  it('handles email selection correctly', async () => {
    const mockEmails = [
      {
        id: '1',
        from: 'sender@example.com',
        subject: 'Test Email',
        body: 'Test body',
        date: '2023-01-01T00:00:00Z',
        read: false,
        starred: false,
        hasAttachments: false,
      },
    ];

    const mockOnSelect = vi.fn();

    render(
      <VirtualizedEmailList
        mails={mockEmails}
        selectedMailIds={new Set()}
        onSelectMail={mockOnSelect}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onToggleSelect={vi.fn()}
      />
    );

    const emailItem = screen.getByText('Test Email');
    fireEvent.click(emailItem);

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(mockEmails[0]);
    });
  });
});

describe('Email Viewer Component', () => {
  it('renders email content correctly', () => {
    const mockEmail = {
      id: '1',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Email',
      body: 'Test body content',
      htmlBody: '<p>Test body content</p>',
      date: '2023-01-01T00:00:00Z',
      read: false,
      starred: false,
      hasAttachments: false,
    };

    render(
      <EmailViewer
        mail={mockEmail}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onForward={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onToggleStar={vi.fn()}
      />
    );

    expect(screen.getByText('Test Email')).toBeInTheDocument();
    expect(screen.getByText('sender@example.com')).toBeInTheDocument();
    expect(screen.getByText('recipient@example.com')).toBeInTheDocument();
    expect(screen.getByText('Test body content')).toBeInTheDocument();
  });

  it('calls appropriate handlers when actions are clicked', async () => {
    const mockEmail = {
      id: '1',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Email',
      body: 'Test body content',
      date: '2023-01-01T00:00:00Z',
      read: false,
      starred: false,
      hasAttachments: false,
    };

    const mockOnReply = vi.fn();
    const mockOnDelete = vi.fn();
    const mockOnToggleStar = vi.fn();

    render(
      <EmailViewer
        mail={mockEmail}
        onReply={mockOnReply}
        onReplyAll={vi.fn()}
        onForward={vi.fn()}
        onArchive={vi.fn()}
        onDelete={mockOnDelete}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onToggleStar={mockOnToggleStar}
      />
    );

    const replyButton = screen.getByText('Reply');
    const deleteButton = screen.getByText('Delete');
    const starButton = screen.getByText('Star');

    fireEvent.click(replyButton);
    fireEvent.click(deleteButton);
    fireEvent.click(starButton);

    await waitFor(() => {
      expect(mockOnReply).toHaveBeenCalled();
      expect(mockOnDelete).toHaveBeenCalled();
      expect(mockOnToggleStar).toHaveBeenCalled();
    });
  });
});

describe('Attachment Upload Component', () => {
  it('renders upload area correctly', () => {
    render(
      <AttachmentUpload
        onUpload={vi.fn()}
        maxFileSize={10 * 1024 * 1024}
        maxFiles={10}
      />
    );

    expect(screen.getByText(/Drop files here or click to upload/)).toBeInTheDocument();
    expect(screen.getByText('Select Files')).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    const mockOnUpload = vi.fn();
    
    render(
      <AttachmentUpload
        onUpload={mockOnUpload}
        maxFileSize={10 * 1024 * 1024}
        maxFiles={10}
      />
    );

    const fileInput = screen.getByLabelText('Select Files');
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith([file]);
    });
  });

  it('validates file size correctly', async () => {
    const mockOnUpload = vi.fn();
    
    render(
      <AttachmentUpload
        onUpload={mockOnUpload}
        maxFileSize={100} // Very small limit
        maxFiles={10}
      />
    );

    const fileInput = screen.getByLabelText('Select Files');
    const largeFile = new File(['large content that exceeds limit'], 'large.txt', { 
      type: 'text/plain' 
    });

    Object.defineProperty(largeFile, 'size', { value: 200 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/is too large/)).toBeInTheDocument();
      expect(mockOnUpload).not.toHaveBeenCalled();
    });
  });
});
