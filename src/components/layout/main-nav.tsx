import { NavLink, type NavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Settings, Inbox, Send, Trash2, Star, FileText } from "lucide-react";

// Create a type for the NavLink with isActive
interface NavLinkWithActiveProps extends Omit<NavLinkProps, 'className'> {
  className?: string | ((props: { isActive: boolean }) => string);
  children: React.ReactNode;
}

function NavItem({ to, children, className }: { to: string; children: React.ReactNode; className?: string | ((props: { isActive: boolean }) => string) }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
          isActive && "bg-muted text-primary",
          typeof className === 'function' ? className({ isActive }) : className
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function MainNav() {
  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      <NavItem to="/">
        <Inbox className="h-4 w-4" />
        收件箱
      </NavItem>
      <NavItem to="/starred">
        <Star className="h-4 w-4" />
        星标
      </NavItem>
      <NavItem to="/sent">
        <Send className="h-4 w-4" />
        已发送
      </NavItem>
      <NavLink
        to="/drafts"
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
            isActive && "bg-muted text-primary"
          )
        } as NavLinkWithActiveProps
      >
        <FileText className="h-4 w-4" />
        草稿
      </NavLink>
      <NavLink
        to="/trash"
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
            isActive && "bg-muted text-primary"
          )
        } as NavLinkWithActiveProps
      >
        <Trash2 className="h-4 w-4" />
        垃圾邮件
      </NavLink>
      <div className="mt-4 pt-4 border-t">
        <NavLink
          to="/settings/accounts"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
              isActive && "bg-muted text-primary"
            )
          } as NavLinkWithActiveProps
        >
          <Settings className="h-4 w-4" />
          账户设置
        </NavLink>
      </div>
    </nav>
  );
}
