"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Building2, FileUser, HeartPulse, House, Layers3, Settings, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/opportunities", label: "Opportunities", icon: Sparkles },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/interviews", label: "Interviews", icon: Layers3 },
  { href: "/profile", label: "Profile", icon: UserRound },
];

const secondaryItems = [
  { href: "/sources", label: "Sources", icon: Building2 },
  { href: "/system-health", label: "System health", icon: HeartPulse },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand({ mobile = false }: { mobile?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" aria-label="Career Autopilot home">
      <span className={cn("grid size-10 place-items-center rounded-xl shadow-sm", mobile ? "bg-primary text-primary-foreground" : "bg-sidebar-primary text-sidebar-primary-foreground")}><FileUser className="size-5" /></span>
      <span>
        <span className={cn("block text-[0.7rem] font-semibold uppercase tracking-[0.18em]", mobile ? "text-muted-foreground" : "text-sidebar-foreground/55")}>Career</span>
        <span className={cn("block text-base font-semibold leading-tight", mobile ? "text-foreground" : "text-sidebar-foreground")}>Autopilot</span>
      </span>
    </Link>
  );
}

function DesktopItem({ href, label, icon: Icon }: (typeof primaryItems)[number]) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
      <Icon className="size-[1.125rem]" />{label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="px-5 py-6"><Brand /></div>
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3">
          {primaryItems.map((item) => <DesktopItem key={item.href} {...item} />)}
          <div className="my-3 border-t border-sidebar-border" />
          {secondaryItems.map((item) => <DesktopItem key={item.href} {...item} />)}
        </nav>
        <div className="m-4 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3">
          <p className="text-xs font-medium text-sidebar-foreground">Private workspace</p>
          <p className="mt-1 text-xs leading-5 text-sidebar-foreground/55">Only strong, unseen opportunities reach your review queue.</p>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="lg:hidden"><Brand mobile /></div>
          <p className="hidden text-sm text-muted-foreground lg:block">Review. Decide. Approve. Apply.</p>
          <ThemeToggle />
        </header>
        <main className="dashboard-grid min-h-[calc(100dvh-4rem)] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10"><div className="mx-auto w-full max-w-6xl">{children}</div></main>
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {primaryItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[0.625rem] font-medium tracking-tight transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}><Icon className={cn("size-5", active && "stroke-[2.4]")} /><span>{label}</span></Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
