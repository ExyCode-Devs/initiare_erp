import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot, Brain, CheckCircle2, Clock, Cpu, Mail, Pause, Play, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, PageHeader, SectionHeader, Stat, StatusBadge } from "@/components/app/primitives";
import { automacaoCards } from "@/lib/mock-data";

export const Route = createFileRoute("/central-ia")({
  head: () => ({ meta: [{ title: "Central IA · Veridia" }] }),
  component: CentralIA,
});

const perf = Array.from({ length: 30 }, (_, i) => ({
  d: i + 1,
  acc: 92 + Math.sin(i / 3) * 3 + Math.random() * 2,
  ops: 80 + Math.cos(i / 4) * 30 + Math.random() * 20,
}));

function CentralIA() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-8">
      <PageHeader
        title="Central IA"
        desc="Seu copiloto financeiro. Status, automações ativas e métricas operacionais em tempo real."
        actions={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-ai/10 border border-ai/25 text-[12px] text-ai">
            <span className="relative flex size-1.5"><span className="absolute inset-0 rounded-full bg-ai pulse-ring" /><span className="relative rounded-full size-1.5 bg-ai" /></span>
            Modelo veridia-finance-v3.2 · saudável
          </div>
        }
      />

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Operações hoje" value="1.842" accent="ai" icon={<Cpu className="size-4" />} />
        <Stat label="Precisão" value="96.4%" accent="success" icon={<CheckCircle2 className="size-4" />} />
        <Stat label="Economia mensal" value="R$ 42.8k" accent="info" icon={<TrendingUp className="size-4" />} />
        <Stat label="Tempo poupado" value="284h" accent="warning" icon={<Clock className="size-4" />} />
        <Stat label="Automações ativas" value="14" icon={<Zap className="size-4" />} />
        <Stat label="Modelos rodando" value="6" icon={<Brain className="size-4" />} />
      </div>

      {/* Performance */}
      <Card className="p-5">
        <SectionHeader title="Performance da IA · 30 dias" desc="Precisão (%) e volume de operações processadas" />
        <div className="h-[280px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={perf}>
              <defs>
                <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ai)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--ai)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ops" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--info)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="acc" stroke="var(--ai)" strokeWidth={2} fill="url(#acc)" />
              <Area type="monotone" dataKey="ops" stroke="var(--info)" strokeWidth={2} fill="url(#ops)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Automation cards */}
      <section>
        <SectionHeader title="Automações ativas" desc="Cada agente IA executa um domínio específico" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automacaoCards.map((a, i) => {
            const icons = [Sparkles, Mail, Bot, Brain, Zap, CheckCircle2];
            const Icon = icons[i % icons.length];
            return (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-5 hover:border-border-strong hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="size-9 rounded-lg bg-ai/12 text-ai grid place-items-center group-hover:bg-ai/18 transition-colors">
                    <Icon className="size-4.5" />
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-4">
                  <div className="text-[14px] font-semibold">{a.title}</div>
                  <div className="text-[12.5px] text-muted-foreground mt-1">{a.desc}</div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Execuções</div>
                    <div className="text-[15px] font-semibold tabular-nums mt-0.5">{a.runs.toLocaleString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Precisão</div>
                    <div className="text-[15px] font-semibold tabular-nums mt-0.5 text-success">{a.accuracy}%</div>
                  </div>
                </div>
                <button className="mt-4 w-full h-8 rounded-md border border-border text-[12px] hover:bg-accent inline-flex items-center justify-center gap-1.5">
                  {a.status === "active" ? <><Pause className="size-3" /> Pausar</> : <><Play className="size-3" /> Ativar</>}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
