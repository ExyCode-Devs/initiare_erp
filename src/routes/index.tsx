import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, CircleAlert,
  Sparkles, Wallet, Zap,
} from "lucide-react";
import { Card, SectionHeader, Stat } from "@/components/app/primitives";
import { aiActivity, cashflow, conciliacaoDaily, expensesByCategory } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · Veridia" }] }),
  component: Dashboard,
});

const chartColors = ["var(--ai)", "var(--info)", "var(--warning)", "var(--chart-4)", "var(--success)", "var(--muted-foreground)"];

function Dashboard() {
  return (
    <div className="grid-bg">
      <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
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
                IA operando · ciclo #2.184
              </div>
              <h1 className="text-[32px] md:text-[36px] font-semibold tracking-tight leading-tight">
                Bom dia, Rafael.
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground text-balance">
                A IA processou <span className="text-foreground font-medium tabular-nums">42 operações</span> automaticamente hoje.{" "}
                <span className="text-foreground font-medium">17 exceções</span> aguardam sua revisão.
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
                <div className="text-[20px] font-semibold tabular-nums mt-1">99.98%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Integrações</div>
                <div className="text-[20px] font-semibold tabular-nums mt-1">8/8</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Latência</div>
                <div className="text-[20px] font-semibold tabular-nums mt-1">142<span className="text-sm text-muted-foreground">ms</span></div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Stat cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Conciliado automaticamente" value="92%" delta={{ value: "+4.2pp", positive: true }} icon={<CheckCircle2 className="size-4" />} accent="ai" />
          <Stat label="Processado pela IA" value="R$ 184k" delta={{ value: "+18%", positive: true }} icon={<Wallet className="size-4" />} accent="info" />
          <Stat label="Exceções em revisão" value="17" delta={{ value: "-23%", positive: true }} icon={<AlertTriangle className="size-4" />} accent="warning" />
          <Stat label="Pagamentos programados" value="43" delta={{ value: "+12", positive: true }} icon={<Zap className="size-4" />} accent="success" />
        </section>

        {/* Charts row 1 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-5">
            <SectionHeader
              title="Fluxo de caixa · 12 meses"
              desc="Entradas vs saídas projetadas com IA"
              action={<div className="flex gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-sm bg-ai" /> Entrada</span>
                <span className="inline-flex items-center gap-1.5 ml-3 text-muted-foreground"><span className="size-2 rounded-sm bg-info" /> Saída</span>
              </div>}
            />
            <div className="h-[260px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflow}>
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
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}k`} />
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
                  <Pie data={expensesByCategory} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="var(--background)" strokeWidth={2}>
                    {expensesByCategory.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              {expensesByCategory.map((c, i) => (
                <div key={c.name} className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="size-2 rounded-sm" style={{ background: chartColors[i] }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="ml-auto tabular-nums">{c.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Charts row 2 + AI feed */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-5">
            <SectionHeader title="Conciliação diária" desc="Últimos 14 dias · automática vs manual" />
            <div className="h-[220px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conciliacaoDaily} barCategoryGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="auto" stackId="a" fill="var(--ai)" radius={[0,0,0,0]} />
                  <Bar dataKey="manual" stackId="a" fill="var(--muted-foreground)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* AI live feed */}
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
              {aiActivity.map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-2.5 px-5 py-2.5 hover:bg-accent/40"
                >
                  <span className="text-muted-foreground/70 tabular-nums shrink-0">{a.t}</span>
                  {a.type === "ok" && <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />}
                  {a.type === "warn" && <CircleAlert className="size-3.5 text-warning shrink-0 mt-0.5" />}
                  {a.type === "err" && <AlertTriangle className="size-3.5 text-destructive shrink-0 mt-0.5" />}
                  <span className="text-foreground/90 leading-snug">{a.text}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </section>

        {/* Timeline / quick metrics strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden bg-border">
          {[
            { l: "Tempo economizado (mês)", v: "284h" },
            { l: "Economia operacional", v: "R$ 42.8k" },
            { l: "Precisão IA", v: "96.4%" },
            { l: "Operações no mês", v: "8.241" },
          ].map((s) => (
            <div key={s.l} className="bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider">
                <Activity className="size-3" /> {s.l}
              </div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums">{s.v}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
