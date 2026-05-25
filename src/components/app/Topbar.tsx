import { Search, Bell, MessageSquare, Sparkles, Command, Plug, Globe } from "lucide-react";
import { motion } from "framer-motion";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="h-full px-5 flex items-center gap-4">
        {/* Breadcrumb / status */}
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Globe className="size-3.5" />
          <span>app.veridia.io</span>
          <span className="text-border">/</span>
          <span className="text-foreground font-medium">Acme Holdings</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              placeholder="Buscar operações, fornecedores, NFs…"
              className="w-full h-9 pl-9 pr-16 rounded-md bg-surface border border-border text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-border-strong focus:bg-surface-elevated transition-colors"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
              <Command className="size-2.5" /> K
            </kbd>
          </div>
        </div>

        {/* AI status */}
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
          <span className="text-[11px] text-muted-foreground">· 42 ops/h</span>
        </motion.div>

        {/* Integrations */}
        <button className="hidden lg:flex items-center gap-1.5 h-9 px-2.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Plug className="size-3.5" />
          <span>8 integrações</span>
          <span className="size-1.5 rounded-full bg-success" />
        </button>

        {/* Notifications */}
        <button className="relative size-9 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="size-4" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-warning" />
        </button>

        {/* Chat (IA) */}
        <a
          href="/chat"
          className="size-9 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Abrir chat com a IA"
        >
          <MessageSquare className="size-4" />
        </a>

        {/* AI quick */}
        <button className="size-9 grid place-items-center rounded-md bg-ai/10 border border-ai/25 text-ai hover:bg-ai/15 transition-colors">
          <Sparkles className="size-4" />
        </button>
      </div>
    </header>
  );
}
