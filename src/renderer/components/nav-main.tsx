import { type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  return (
    <nav className="flex flex-col items-center gap-1">
      {items.map((item) => (
        <Link
          key={item.title}
          to={item.url}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors [&.active]:bg-accent [&.active]:text-accent-foreground"
          activeProps={{
            className: "bg-accent text-accent-foreground"
          }}
        >
          {item.icon && <item.icon className="size-5" />}
        </Link>
      ))}
    </nav>
  );
}
