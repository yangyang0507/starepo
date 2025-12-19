import { IconMessage2Star } from "@tabler/icons-react";

export function Logo() {
  return (
    <div className="flex h-full items-center justify-center">
      <a href="#" className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
        <IconMessage2Star className="size-6" />
      </a>
    </div>
  );
}
