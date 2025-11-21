import { Mail } from "@/types/mail";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Star, StarFilled } from "@/components/ui/icons";

interface MailListItemProps {
  mail: Mail;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStar: (id: string, starred: boolean) => void;
  onClick: (mail: Mail) => void;
}

export function MailListItem({
  mail,
  isSelected,
  onSelect,
  onStar,
  onClick,
}: MailListItemProps) {
  return (
    <div
      className={cn(
        "flex items-center p-4 border-b hover:bg-muted/50 cursor-pointer",
        !mail.read && "font-semibold bg-muted/20",
        isSelected && "bg-primary/5"
      )}
      onClick={() => onClick(mail)}
    >
      <div className="flex items-center space-x-2 flex-shrink-0">
        <Checkbox
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={() => onSelect(mail.id)}
          className="h-4 w-4"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStar(mail.id, !mail.starred);
          }}
          className="text-muted-foreground hover:text-yellow-500"
        >
          {mail.starred ? (
            <StarFilled className="h-4 w-4 text-yellow-500" />
          ) : (
            <Star className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="ml-4 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium truncate">
            {mail.folderId === 'sent' ? `To: ${mail.to.join(', ')}` : mail.from}
          </p>
          <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
            {format(new Date(mail.date), 'MMM d')}
          </p>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {mail.subject || '(No subject)'}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {mail.body.substring(0, 100)}
          {mail.body.length > 100 ? '...' : ''}
        </p>
      </div>
    </div>
  );
}
