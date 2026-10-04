"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Lightbulb, MessageSquareText, Sparkles, Database, Telescope } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: Lightbulb },
  { href: "/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/ask", label: "Ask AI", icon: Sparkles },
  { href: "/data", label: "Data", icon: Database },
];

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="border-b bg-background md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-2 px-4 py-4 md:px-5 md:py-6">
        <div className="flex items-center gap-2">
          <Telescope className="size-5 text-ai-foreground" aria-hidden />
          <span className="font-semibold tracking-tight">Discovery Engine</span>
        </div>
        <ThemeToggle className="md:hidden" />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3 md:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive(href) && "bg-muted font-medium text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <p className="hidden px-5 pt-8 text-xs leading-relaxed text-muted-foreground md:block">
        Google Photos · Retrieval research
      </p>
      <div className="hidden px-4 pb-6 md:mt-auto md:block">
        <ThemeToggle />
      </div>
    </aside>
  );
}
