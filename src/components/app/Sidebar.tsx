import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";
import type { ChangelogPublicResponse } from "@/lib/api-types";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type IconName = keyof typeof Icons;

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as any)[name as IconName] as React.ComponentType<{ className?: string }>;
  return Cmp ? <Cmp className={className} /> : null;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { activeCompany, memberships, switchCompany, user } = useAuth();
  const { data } = useQuery({
    queryKey: ["sidebar-dashboard"],
    queryFn: () => apiRequest<{ hero: { openExceptions: number } }>("/dashboard/overview"),
    staleTime: 60_000
  });
  const notificationsQuery = useQuery({
    queryKey: ["public-changelog"],
    queryFn: () => apiRequest<ChangelogPublicResponse>("/changelog"),
    staleTime: 60_000,
  });
  const unreadNotifications =
    notificationsQuery.data?.items.filter((item) => item.unread).length ?? 0;

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 flex flex-col",
        collapsed ? "w-[68px]" : "w-[252px]"
      )}
    >
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-md bg-gradient-to-br from-ai to-info flex items-center justify-center shadow-elegant shrink-0">
            <Icons.Hexagon className="size-4 text-ai-foreground" strokeWidth={2.5} />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-tight truncate">Veridia</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Finance OS</div>
            </div>
          ) : null}
        </div>
        <button
          onClick={() => setCollapsed((value) => !value)}
          className="ml-auto p-1.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icons.PanelLeft className="size-4" />
        </button>
      </div>

      {!collapsed ? (
        <div className="px-3 pt-3">
          <button className="w-full flex items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 hover:bg-sidebar-accent transition-colors">
            <div className="size-6 rounded bg-gradient-to-br from-chart-4 to-chart-2 grid place-items-center text-[10px] font-semibold text-white">
              {(activeCompany?.name ?? "VR").slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="text-[12px] font-medium truncate">{activeCompany?.name ?? "Workspace"}</div>
              <div className="text-[10px] text-muted-foreground truncate">Operacao Brasil</div>
            </div>
            {memberships.length > 1 ? (
              <select
                value={activeCompany?.id ?? ""}
                onChange={(event) => void switchCompany(event.target.value)}
                className="max-w-[110px] rounded border border-sidebar-border bg-sidebar px-1 py-0.5 text-[10px] text-muted-foreground"
              >
                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.company.id}>
                    {membership.company.name}
                  </option>
                ))}
              </select>
            ) : (
              <Icons.ChevronsUpDown className="size-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {navItems.map((group) => (
          <div key={group.group}>
            {!collapsed ? (
              <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.group}
              </div>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.to;
                const badge =
                  item.to === "/excecoes"
                    ? data?.hero.openExceptions
                    : item.to === "/novidades"
                      ? unreadNotifications
                      : undefined;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-all",
                      active
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    {active ? (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-ai"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                    <NavIcon name={item.icon} className="size-4 shrink-0" />
                    {!collapsed ? <span className="truncate flex-1">{item.label}</span> : null}
                    {!collapsed && badge ? (
                      <span
                        data-testid={
                          item.to === "/novidades"
                            ? "sidebar-notifications-badge"
                            : undefined
                        }
                        className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/20"
                      >
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="relative">
            <div className="size-8 rounded-full bg-gradient-to-br from-ai to-info grid place-items-center text-[11px] font-semibold text-ai-foreground">
              {(user?.name ?? "VR").slice(0, 2).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-sidebar" />
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium truncate">{user?.name ?? "Usuario"}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.role ?? "VIEWER"}</div>
            </div>
          ) : null}
          {!collapsed ? <Icons.MoreHorizontal className="size-4 text-muted-foreground" /> : null}
        </div>
      </div>
    </aside>
  );
}
