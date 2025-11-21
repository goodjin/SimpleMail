import { useState } from 'react';
import { MailView } from '@/components/mail/mail-view';
import { Sidebar } from '@/components/layout/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { cn } from '@/lib/utils';

export function MailPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="border-b border-border">
          <div className="flex h-16 items-center px-4">
            <button
              className="md:hidden mr-4"
              onClick={() => setIsSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <MainNav className="mx-6" />
            <div className="ml-auto flex items-center space-x-4">
              {/* Add search, settings, etc. */}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <MailView />
        </main>
      </div>
    </div>
  );
}
