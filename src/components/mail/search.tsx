import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Filter, 
  Calendar, 
  Mail, 
  User, 
  Paperclip,
  Star,
  Eye,
  EyeOff,
  X,
  Clock,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { Mail as MailType } from '@/types/mail';
import { cn } from '@/lib/utils';

export interface SearchFilters {
  query: string;
  accountId?: string;
  folderId?: string;
  dateFrom?: string;
  dateTo?: string;
  sender?: string;
  subjectContains?: string;
  bodyContains?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
}

export interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  isSearching?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

export interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  accounts?: { id: string; name: string }[];
  folders?: { id: string; name: string }[];
}

export interface SearchResultsProps {
  results: MailType[];
  totalCount: number;
  queryTime: number;
  isLoading?: boolean;
  onEmailSelect: (email: MailType) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function SearchBar({ 
  onSearch, 
  onClear, 
  isSearching = false, 
  placeholder = "Search emails...",
  suggestions = []
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query && suggestions.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [query, suggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch({ query: query.trim() });
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch({ query: suggestion });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(query.trim() !== '')}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => {
                setQuery('');
                onClear();
                setShowSuggestions(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>

      {showSuggestions && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1">
          <CardContent className="p-2">
            <div className="space-y-1">
              {filteredSuggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start text-sm h-8"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <Search className="h-3 w-3 mr-2 text-muted-foreground" />
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function SearchFilters({ 
  filters, 
  onFiltersChange, 
  accounts = [], 
  folders = [] 
}: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      query: filters.query
    });
  };

  const hasActiveFilters = Object.keys(filters).some(key => 
    key !== 'query' && filters[key as keyof SearchFilters] !== undefined
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Search Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Filter */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label>Account</Label>
                <select
                  value={filters.accountId || ''}
                  onChange={(e) => handleFilterChange('accountId', e.target.value || undefined)}
                  className="w-full p-2 border border-border rounded-md bg-background"
                >
                  <option value="">All Accounts</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Folder Filter */}
            {folders.length > 0 && (
              <div className="space-y-2">
                <Label>Folder</Label>
                <select
                  value={filters.folderId || ''}
                  onChange={(e) => handleFilterChange('folderId', e.target.value || undefined)}
                  className="w-full p-2 border border-border rounded-md bg-background"
                >
                  <option value="">All Folders</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
              />
            </div>

            {/* Sender */}
            <div className="space-y-2">
              <Label>Sender</Label>
              <Input
                placeholder="Filter by sender..."
                value={filters.sender || ''}
                onChange={(e) => handleFilterChange('sender', e.target.value || undefined)}
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject Contains</Label>
              <Input
                placeholder="Filter by subject..."
                value={filters.subjectContains || ''}
                onChange={(e) => handleFilterChange('subjectContains', e.target.value || undefined)}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label>Body Contains</Label>
              <Input
                placeholder="Filter by body..."
                value={filters.bodyContains || ''}
                onChange={(e) => handleFilterChange('bodyContains', e.target.value || undefined)}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-attachments"
                checked={filters.hasAttachments || false}
                onCheckedChange={(checked) => 
                  handleFilterChange('hasAttachments', checked === true ? true : undefined)
                }
              />
              <Label htmlFor="has-attachments" className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Has Attachments
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-read"
                checked={filters.isRead === true}
                onCheckedChange={(checked) => 
                  handleFilterChange('isRead', checked === true ? true : undefined)
                }
              />
              <Label htmlFor="is-read" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Read
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-unread"
                checked={filters.isRead === false}
                onCheckedChange={(checked) => 
                  handleFilterChange('isRead', checked === true ? false : undefined)
                }
              />
              <Label htmlFor="is-unread" className="flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                Unread
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-starred"
                checked={filters.isStarred === true}
                onCheckedChange={(checked) => 
                  handleFilterChange('isStarred', checked === true ? true : undefined)
                }
              />
              <Label htmlFor="is-starred" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Starred
              </Label>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function SearchResults({ 
  results, 
  totalCount, 
  queryTime, 
  isLoading = false,
  onEmailSelect,
  onLoadMore,
  hasMore = false
}: SearchResultsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Searching emails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {totalCount} result{totalCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {queryTime}ms
                </span>
              </div>
            </div>
            {results.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Showing {results.length} of {totalCount}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {results.map((email) => (
            <Card 
              key={email.id} 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onEmailSelect(email)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium text-sm",
                          !email.read && "font-semibold"
                        )}>
                          {email.from}
                        </span>
                        {email.hasAttachments && (
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                        )}
                        {email.starred && (
                          <Star className="h-3 w-3 text-yellow-500 fill-current" />
                        )}
                        {!email.read && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            New
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(email.date)}
                      </span>
                    </div>
                    <h4 className={cn(
                      "text-sm mb-1 truncate",
                      !email.read && "font-medium"
                    )}>
                      {email.subject || '(No subject)'}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {email.body || '(No content)'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Load More */}
          {hasMore && onLoadMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={onLoadMore}>
                Load More Results
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
