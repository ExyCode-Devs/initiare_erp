import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card shadow-elegant", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  desc,
  action
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {desc ? <p className="text-[12.5px] text-muted-foreground mt-0.5">{desc}</p> : null}
      </div>
      {action}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  Processado: "bg-success/10 text-success border-success/20",
  Pendente: "bg-warning/10 text-warning border-warning/25",
  "Em revisao": "bg-info/10 text-info border-info/25",
  "Em revisão": "bg-info/10 text-info border-info/25",
  Excecao: "bg-destructive/10 text-destructive border-destructive/25",
  Exceção: "bg-destructive/10 text-destructive border-destructive/25",
  Conciliado: "bg-ai/10 text-ai border-ai/25",
  Alta: "bg-destructive/10 text-destructive border-destructive/25",
  Media: "bg-warning/10 text-warning border-warning/25",
  Média: "bg-warning/10 text-warning border-warning/25",
  Baixa: "bg-info/10 text-info border-info/25",
  active: "bg-success/10 text-success border-success/20",
  paused: "bg-muted text-muted-foreground border-border"
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md border",
        statusStyles[status] ?? "bg-muted text-muted-foreground border-border"
      )}
    >
      <span className="size-1 rounded-full bg-current opacity-80" />
      {status === "active" ? "Ativa" : status === "paused" ? "Pausada" : status}
    </span>
  );
}

export function Stat({
  label,
  value,
  delta,
  icon,
  accent
}: {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  icon?: ReactNode;
  accent?: "ai" | "info" | "warning" | "success";
}) {
  const accentClass =
    accent === "ai"
      ? "from-ai/15 to-transparent"
      : accent === "info"
        ? "from-info/15 to-transparent"
        : accent === "warning"
          ? "from-warning/15 to-transparent"
          : accent === "success"
            ? "from-success/15 to-transparent"
            : "from-foreground/5 to-transparent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-xl border border-border bg-card overflow-hidden group hover:border-border-strong transition-colors"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", accentClass)} />
      <div className="relative p-4">
        <div className="flex items-start justify-between">
          <span className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          {icon ? (
            <span
              className={cn(
                "size-7 rounded-md grid place-items-center",
                accent === "ai"
                  ? "bg-ai/15 text-ai"
                  : accent === "info"
                    ? "bg-info/15 text-info"
                    : accent === "warning"
                      ? "bg-warning/15 text-warning"
                      : accent === "success"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
              )}
            >
              {icon}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[26px] font-semibold tracking-tight tabular-nums">{value}</span>
          {delta ? (
            <span
              className={cn(
                "text-[11.5px] font-medium tabular-nums",
                delta.positive ? "text-success" : "text-destructive"
              )}
            >
              {delta.positive ? "▲" : "▼"} {delta.value}
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.9 ? "bg-success" : value >= 0.7 ? "bg-info" : value >= 0.5 ? "bg-warning" : "bg-destructive";

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  actions
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {desc ? <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl text-balance">{desc}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-2 rounded-lg border border-border bg-card/60">
      {children}
    </div>
  );
}

export function FilterButton({ icon, label, value }: { icon?: ReactNode; label: string; value?: string }) {
  return (
    <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-accent text-[12px] transition-colors">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      {value ? <span className="font-medium">{value}</span> : null}
    </button>
  );
}
