import { X, Inbox, Send, FileText, Trash2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: '收件箱', href: '#', icon: Inbox, count: 5, current: true },
  { name: '已发送', href: '#', icon: Send, count: 0, current: false },
  { name: '草稿', href: '#', icon: FileText, count: 0, current: false },
  { name: '归档', href: '#', icon: Archive, count: 0, current: false },
  { name: '垃圾箱', href: '#', icon: Trash2, count: 0, current: false },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile sidebar backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden',
          isOpen ? 'block' : 'hidden'
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 w-64 bg-background z-50 transform transition-transform duration-300 ease-in-out',
          'flex flex-col border-r border-border',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:translate-x-0 md:flex-shrink-0'
        )}
      >
        {/* Close button for mobile */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border md:hidden">
          <div className="text-lg font-semibold">邮件客户端</div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={cn(
                item.current
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
              )}
            >
              <item.icon
                className={cn(
                  item.current ? 'text-primary' : 'text-muted-foreground',
                  'mr-3 flex-shrink-0 h-5 w-5'
                )}
                aria-hidden="true"
              />
              {item.name}
              {item.count > 0 && (
                <span
                  className={cn(
                    item.current ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground',
                    'ml-auto inline-block py-0.5 px-2.5 text-xs rounded-full'
                  )}
                >
                  {item.count}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-border">
          <Button className="w-full">
            写邮件
          </Button>
        </div>
      </div>
    </>
  );
}
