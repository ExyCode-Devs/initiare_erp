import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Sparkles,
  Wallet,
  Zap
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, SectionHeader, Stat } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type DashboardResponse = {
  hero: {
    greetingName: string;
    cycleLabel: string;
    processedToday: number;
    openExceptions: number;
    uptime: number;
    integrationsHealthy: number;
    integrationsTotal: number;
    latencyMs: number;
  };
  stats: {
    autoReconciliationRate: number;
    processedByAiAmount: number;
    openExceptions: number;
    scheduledPayments: number;
  };
  cashflow: Array<{ month: string; entrada: number; saida: number }>;
  expensesByCategory: Array<{ name: string; value: number }>;
  reconciliationDaily: Array<{ day: string; auto: number; manual: number }>;
  aiActivity: Array<{ t: string; type: "ok" | "warn" | "err"; text: string }>;
  timeline: Array<{ label: string; value: string }>;
};

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · Veridia" }] }),
  component: Dashboard
});

const chartColors = ["var(--ai)", "var(--info)", "var(--warning)", "var(--chart-4)", "var(--success)", "var(--muted-foreground)"];

function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => apiRequest<DashboardResponse>("/dashboard/overview")
  });

  if (isLoading) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineState label="Carregando dashboard..." />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineError label="Nao foi possivel carregar o dashboard." />
      </div>
    );
  }

  return (
    <div className="grid-bg">
      <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-elevated via-card to-card p-8"
        >
          <div className="absolute -top-24 -right-24 size-80 rounded-full bg-ai/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 size-72 rounded-full bg-info/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-ai/25 bg-ai/8 text-[11px] text-ai font-medium mb-4">
                <Sparkles className="size-3" />
                IA operando · {data.hero.cycleLabel}
              </div>
              <h1 className="text-[32px] md:text-[36px] font-semibold tracking-tight leading-tight">
                Bom dia, {data.hero.greetingName}.
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground text-balance">
                A IA processou <span className="text-foreground font-medium tabular-nums">{data.hero.processedToday} operações</span>{" "}
                automaticamente hoje. <span className="text-foreground font-medium">{data.hero.openExceptions} exceções</span> aguardam sua revisão.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:opacity-90">
                  Revisar exceções <ArrowRight className="size-3.5" />
                </button>
                <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-border bg-card text-[13px] hover:bg-accent">
                  <Bot className="size-3.5" /> Falar com a IA
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-right shrink-0">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Uptime IA</div>
                <div className="text-[20px] font-semibold tabular-nums mt-1">{data.hero.uptime.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Integrações</div>
                <div className="text-[20px] font-semibold tabular-nums mt-1">
                  {data.hero.integrationsHealthy}/{data.hero.integrationsTotal}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Latência</div>
                <div className="text-[20px] font-semibold tabular-nums mt-1">
                  {data.hero.latencyMs}
                  <span className="text-sm text-muted-foreground">ms</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Conciliado automaticamente" value={`${data.stats.autoReconciliationRate}%`} delta={{ value: "+4.2pp", positive: true }} icon={<CheckCircle2 className="size-4" />} accent="ai" />
          <Stat label="Processado pela IA" value={formatCurrency(data.stats.processedByAiAmount)} delta={{ value: "+18%", positive: true }} icon={<Wallet className="size-4" />} accent="info" />
          <Stat label="Exceções em revisão" value={String(data.stats.openExceptions)} delta={{ value: "-23%", positive: true }} icon={<AlertTriangle className="size-4" />} accent="warning" />
          <Stat label="Pagamentos programados" value={String(data.stats.scheduledPayments)} delta={{ value: "+12", positive: true }} icon={<Zap className="size-4" />} accent="success" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-5">
            <SectionHeader
              title="Fluxo de caixa · 12 meses"
              desc="Entradas vs saídas projetadas com IA"
              action={
                <div className="flex gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-sm bg-ai" /> Entrada
                  </span>
                  <span className="inline-flex items-center gap-1.5 ml-3 text-muted-foreground">
                    <span className="size-2 rounded-sm bg-info" /> Saída
                  </span>
                </div>
              }
            />
            <div className="h-[260px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.cashflow}>
                  <defs>
                    <linearGradient id="entrada" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--ai)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--ai)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="saida" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--info)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}k`} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="entrada" stroke="var(--ai)" strokeWidth={2} fill="url(#entrada)" />
                  <Area type="monotone" dataKey="saida" stroke="var(--info)" strokeWidth={2} fill="url(#saida)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Despesas por categoria" desc="Distribuição mensal" />
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.expensesByCategory} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="var(--background)" strokeWidth={2}>
                    {data.expensesByCategory.map((_, index) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              {data.expensesByCategory.map((item, index) => (
                <div key={item.name} className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="size-2 rounded-sm" style={{ background: chartColors[index % chartColors.length] }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="ml-auto tabular-nums">{item.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-5">
            <SectionHeader title="Conciliação diária" desc="Últimos 14 dias · automática vs manual" />
            <div className="h-[220px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.reconciliationDaily} barCategoryGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="auto" stackId="a" fill="var(--ai)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="manual" stackId="a" fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inset-0 rounded-full bg-ai pulse-ring" />
                  <span className="relative rounded-full size-2 bg-ai" />
                </span>
                <span className="text-[13px] font-semibold">IA trabalhando agora</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">LIVE</span>
            </div>
            <div className="font-mono text-[11.5px] divide-y divide-border max-h-[260px] overflow-y-auto">
              {data.aiActivity.map((item, index) => (
                <motion.div
                  key={`${item.t}-${index}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-start gap-2.5 px-5 py-2.5 hover:bg-accent/40"
                >
                  <span className="text-muted-foreground/70 tabular-nums shrink-0">{item.t}</span>
                  {item.type === "ok" ? <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" /> : null}
                  {item.type === "warn" ? <CircleAlert className="size-3.5 text-warning shrink-0 mt-0.5" /> : null}
                  {item.type === "err" ? <AlertTriangle className="size-3.5 text-destructive shrink-0 mt-0.5" /> : null}
                  <span className="text-foreground/90 leading-snug">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden bg-border">
          {data.timeline.map((item) => (
            <div key={item.label} className="bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider">
                <Activity className="size-3" /> {item.label}
              </div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums">{item.value}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
