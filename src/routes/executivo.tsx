import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card, PageHeader, SectionHeader, Stat } from "@/components/app/primitives";
import { cashflow } from "@/lib/mock-data";

export const Route = createFileRoute("/executivo")({
  head: () => ({ meta: [{ title: "Dashboard Executivo · Veridia" }] }),
  component: Executivo,
});

const dre = [
  { l: "Receita bruta", v: 1240000, t: "in" },
  { l: "Deduções", v: -84000, t: "out" },
  { l: "Receita líquida", v: 1156000, t: "in", bold: true },
  { l: "Custo de serviços", v: -342000, t: "out" },
  { l: "Lucro bruto", v: 814000, t: "in", bold: true },
  { l: "Despesas operacionais", v: -421000, t: "out" },
  { l: "EBITDA", v: 393000, t: "in", bold: true },
  { l: "Impostos", v: -82000, t: "out" },
  { l: "Lucro líquido", v: 311000, t: "in", bold: true, hl: true },
];

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function Executivo() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Dashboard Executivo"
        desc="Visão consolidada de performance financeira · período: maio/2026"
        actions={
          <div className="flex gap-1.5">
            {["Mês", "Trimestre", "Ano"].map((p, i) => (
              <button key={p} className={`h-8 px-2.5 rounded-md text-[12px] ${i===0 ? "bg-foreground text-background" : "border border-border hover:bg-accent"}`}>{p}</button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Receita" value="R$ 1.24M" delta={{ value: "+18.4%", positive: true }} accent="success" icon={<TrendingUp className="size-4" />} />
        <Stat label="EBITDA" value="R$ 393k" delta={{ value: "+22.1%", positive: true }} accent="ai" icon={<ArrowUp className="size-4" />} />
        <Stat label="Despesas" value="R$ 847k" delta={{ value: "+8.2%", positive: false }} accent="warning" icon={<ArrowDown className="size-4" />} />
        <Stat label="Inadimplência" value="2.1%" delta={{ value: "-0.6pp", positive: true }} accent="info" icon={<TrendingDown className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <SectionHeader title="Fluxo de caixa projetado" desc="Previsão IA · próximos 12 meses" />
          <div className="h-[300px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="entrada" stroke="var(--ai)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="saida" stroke="var(--info)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Insights IA" />
          <div className="space-y-3">
            {[
              { c: "ai", t: "Antecipação inteligente", d: "Receba R$ 184k antes — economia projetada de R$ 4.120 em juros." },
              { c: "warning", t: "Concentração de despesas", d: "62% dos gastos em 4 fornecedores · risco de dependência." },
              { c: "success", t: "Eficiência operacional", d: "Custo por transação caiu 23% nos últimos 90 dias." },
            ].map((i) => (
              <div key={i.t} className="p-3 rounded-lg border border-border bg-card/50">
                <div className="flex items-start gap-2">
                  <Sparkles className={`size-3.5 mt-0.5 shrink-0 ${i.c === "ai" ? "text-ai" : i.c === "warning" ? "text-warning" : "text-success"}`} />
                  <div>
                    <div className="text-[13px] font-medium">{i.t}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{i.d}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <SectionHeader title="DRE · maio/2026" desc="Estrutura de resultado consolidada" />
          <table className="w-full text-[13px]">
            <tbody>
              {dre.map((r, i) => (
                <tr key={i} className={`border-b border-border last:border-0 ${r.hl ? "bg-ai/5" : ""}`}>
                  <td className={`py-2.5 ${r.bold ? "font-semibold" : "text-muted-foreground"}`}>{r.l}</td>
                  <td className={`py-2.5 text-right tabular-nums ${r.bold ? "font-semibold" : ""} ${r.t === "out" ? "text-destructive" : ""}`}>{fmt(r.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Comparativo mensal" />
          <div className="h-[240px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflow.slice(-6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="entrada" radius={[4,4,0,0]}>
                  {cashflow.slice(-6).map((_, i) => <Cell key={i} fill={i === 5 ? "var(--ai)" : "var(--muted-foreground)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
