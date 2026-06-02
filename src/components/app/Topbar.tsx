import { useQuery } from "@tanstack/react-query";
import { Search, Bell, Plus, Sparkles, Command, Plug, Globe, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export function Topbar() {
  const { company, logout } = useAuth();
  const { data } = useQuery({
    queryKey: ["topbar-monitoring"],
    queryFn: () =>
      apiRequest<{
        api: { latencyMs: number };
        application: { integrationsHealthy: number; integrationsTotal: number };
      }>("/monitoring/summary"),
    staleTime: 60_000
  });

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="h-full px-5 flex items-center gap-4">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Globe className="size-3.5" />
          <span>{company?.domain ?? "app.veridia.local"}</span>
          <span className="text-border">/</span>
          <span className="text-foreground font-medium">{company?.name ?? "Workspace"}</span>
        </div>

        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              placeholder="Buscar operacoes, fornecedores, NFs..."
              className="w-full h-9 pl-9 pr-16 rounded-md bg-surface border border-border text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-border-strong focus:bg-surface-elevated transition-colors"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
              <Command className="size-2.5" /> K
            </kbd>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-ai/8 border border-ai/20"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-ai pulse-ring" />
            <span className="relative rounded-full size-1.5 bg-ai" />
          </span>
          <span className="text-[11.5px] font-medium text-foreground">IA operando</span>
          <span className="text-[11px] text-muted-foreground">· {data?.api.latencyMs ?? 0} ms</span>
        </motion.div>

        <button className="hidden lg:flex items-center gap-1.5 h-9 px-2.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Plug className="size-3.5" />
          <span>
            {data?.application.integrationsHealthy ?? 0}/{data?.application.integrationsTotal ?? 0} integrações
          </span>
          <span className="size-1.5 rounded-full bg-success" />
        </button>

        <button className="relative size-9 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="size-4" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-warning" />
        </button>

        <button className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90 transition-opacity">
          <Plus className="size-3.5" />
          Criar
        </button>

        <button className="size-9 grid place-items-center rounded-md bg-ai/10 border border-ai/25 text-ai hover:bg-ai/15 transition-colors">
          <Sparkles className="size-4" />
        </button>

        <button
          onClick={logout}
          className="size-9 grid place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
