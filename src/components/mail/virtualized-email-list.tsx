import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mail, Star, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail as MailType } from '@/types/mail';
import { cn } from '@/lib/utils';

interface EmailListItemProps {
  mail: MailType;
  isSelected: boolean;
  onSelect: (mail: MailType) => void;
  onToggleRead: (mailId: string) => void;
  onToggleStar: (mailId: string) => void;
  onToggleSelect: (mailId: string) => void;
}

function EmailListItem({ 
  mail, 
  isSelected, 
  onSelect, 
  onToggleRead, 
  onToggleStar, 
  onToggleSelect 
}: EmailListItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelect(mail);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    onToggleSelect(mail.id);
  };

  const formatPreview = (text: string) => {
    if (!text) return '';
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('zh-CN', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
        !mail.read && "bg-blue-50/50 dark:bg-blue-950/20",
        isSelected && "bg-muted"
      )}
      onClick={handleClick}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
      />
      
      <div className="flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(mail.id);
          }}
          className="h-8 w-8 p-0"
        >
          <Star 
            className={cn(
              "h-4 w-4",
              mail.starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            )}
          />
        </Button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium text-sm truncate",
              !mail.read && "font-semibold"
            )}>
              {mail.from}
            </span>
            {!mail.read && (
              <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {mail.hasAttachments && <Paperclip className="h-3 w-3" />}
            <span>{formatDate(mail.date)}</span>
          </div>
        </div>
        
        <div className={cn(
          "text-sm mb-1 truncate",
          !mail.read && "font-medium"
        )}>
          {mail.subject || '(无主题)'}
        </div>
        
        <div className="text-xs text-muted-foreground truncate">
          {formatPreview(mail.body || '')}
        </div>
      </div>
    </div>
  );
}

interface VirtualizedEmailListProps {
  mails: MailType[];
  selectedMailIds: Set<string>;
  onSelectMail: (mail: MailType) => void;
  onToggleRead: (mailId: string) => void;
  onToggleStar: (mailId: string) => void;
  onToggleSelect: (mailId: string) => void;
  loading?: boolean;
}

export function VirtualizedEmailList({
  mails,
  selectedMailIds,
  onSelectMail,
  onToggleRead,
  onToggleStar,
  onToggleSelect,
  loading = false
}: VirtualizedEmailListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const ITEM_HEIGHT = 88; // Height of each email item in pixels
  const BUFFER_SIZE = 5; // Number of items to render outside viewport
  
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(
      mails.length - 1,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, mails.length]);

  const visibleMails = useMemo(() => {
    return mails.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [mails, visibleRange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Mail className="h-4 w-4 animate-pulse" />
          <span>加载邮件中...</span>
        </div>
      </div>
    );
  }

  if (mails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>没有邮件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* List header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
        <Checkbox />
        <div className="flex-1 text-sm font-medium text-muted-foreground">
          发件人
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          日期
        </div>
      </div>

      {/* Virtualized list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        style={{ height: '100%' }}
      >
        <div style={{ height: mails.length * ITEM_HEIGHT, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${visibleRange.startIndex * ITEM_HEIGHT}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleMails.map((mail: MailType) => (
              <EmailListItem
                key={mail.id}
                mail={mail}
                isSelected={selectedMailIds.has(mail.id)}
                onSelect={onSelectMail}
                onToggleRead={onToggleRead}
                onToggleStar={onToggleStar}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </div>
      </div>

      {/* List footer */}
      <div className="p-2 border-t border-border text-center text-xs text-muted-foreground">
        共 {mails.length} 封邮件
      </div>
    </div>
  );
}
