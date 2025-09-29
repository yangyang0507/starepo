import React from "react";
import { Link } from "@tanstack/react-router";
import { Home, Settings } from "lucide-react";
import { GitBranch as Github } from "lucide-react";

interface NavigationMenuProps {
  children?: React.ReactNode;
  className?: string;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  children,
  className = "",
}) => {
  return (
    <nav
      className={`fixed right-0 bottom-0 left-0 border-t border-gray-200 bg-white px-4 py-2 ${className}`}
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        <Link
          to="/"
          className="flex flex-col items-center p-2 text-gray-600 transition-colors hover:text-blue-600"
          activeProps={{ className: "text-blue-600" }}
        >
          <Home className="h-5 w-5" />
          <span className="mt-1 text-xs">首页</span>
        </Link>

        <Link
          to="/settings"
          className="flex flex-col items-center p-2 text-gray-600 transition-colors hover:text-blue-600"
          activeProps={{ className: "text-blue-600" }}
        >
          <Settings className="h-5 w-5" />
          <span className="mt-1 text-xs">设置</span>
        </Link>

        <Link
          to="/github-repositories"
          className="flex flex-col items-center p-2 text-gray-600 transition-colors hover:text-blue-600"
          activeProps={{ className: "text-blue-600" }}
        >
          <Github className="h-5 w-5" />
          <span className="mt-1 text-xs">仓库</span>
        </Link>
      </div>
      {children}
    </nav>
  );
};
