import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card, PageHeader, SectionHeader, Stat } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type ExecutiveResponse = {
  stats: {
    revenue: number;
    revenueDelta: string;
    ebitda: number;
    ebitdaDelta: string;
    expense: number;
    expenseDelta: string;
    delinquencyRate: string;
    delinquencyDelta: string;
  };
  cashflow: Array<{ month: string; entrada: number; saida: number }>;
  dre: Array<{ l: string; v: number; t: string; bold: boolean; hl: boolean }>;
  insights: Array<{ c: string; t: string; d: string }>;
};

export const Route = createFileRoute("/executivo")({
  head: () => ({ meta: [{ title: "Dashboard Executivo · Veridia" }] }),
  component: Executivo
});

function Executivo() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["executive-overview"],
    queryFn: () => apiRequest<ExecutiveResponse>("/executive/overview")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando dashboard executivo..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar o dashboard executivo." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Dashboard Executivo"
        desc="Visão consolidada de performance financeira."
        actions={
          <div className="flex gap-1.5">
            {["Mês", "Trimestre", "Ano"].map((period, index) => (
              <button key={period} className={`h-8 px-2.5 rounded-md text-[12px] ${index === 0 ? "bg-foreground text-background" : "border border-border hover:bg-accent"}`}>{period}</button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Receita" value={formatCurrency(data.stats.revenue)} delta={{ value: data.stats.revenueDelta, positive: true }} accent="success" icon={<TrendingUp className="size-4" />} />
        <Stat label="EBITDA" value={formatCurrency(data.stats.ebitda)} delta={{ value: data.stats.ebitdaDelta, positive: true }} accent="ai" icon={<ArrowUp className="size-4" />} />
        <Stat label="Despesas" value={formatCurrency(data.stats.expense)} delta={{ value: data.stats.expenseDelta, positive: false }} accent="warning" icon={<ArrowDown className="size-4" />} />
        <Stat label="Inadimplência" value={data.stats.delinquencyRate} delta={{ value: data.stats.delinquencyDelta, positive: true }} accent="info" icon={<TrendingDown className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <SectionHeader title="Fluxo de caixa projetado" desc="Previsão IA · próximos 12 meses" />
          <div className="h-[300px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.cashflow}>
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
            {data.insights.map((item) => (
              <div key={item.t} className="p-3 rounded-lg border border-border bg-card/50">
                <div className="flex items-start gap-2">
                  <Sparkles className={`size-3.5 mt-0.5 shrink-0 ${item.c === "ai" ? "text-ai" : item.c === "warning" ? "text-warning" : "text-success"}`} />
                  <div>
                    <div className="text-[13px] font-medium">{item.t}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{item.d}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <SectionHeader title="DRE" desc="Estrutura de resultado consolidada" />
          <table className="w-full text-[13px]">
            <tbody>
              {data.dre.map((row, index) => (
                <tr key={`${row.l}-${index}`} className={`border-b border-border last:border-0 ${row.hl ? "bg-ai/5" : ""}`}>
                  <td className={`py-2.5 ${row.bold ? "font-semibold" : "text-muted-foreground"}`}>{row.l}</td>
                  <td className={`py-2.5 text-right tabular-nums ${row.bold ? "font-semibold" : ""} ${row.t === "out" ? "text-destructive" : ""}`}>{formatCurrency(row.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Comparativo mensal" />
          <div className="h-[240px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cashflow.slice(-6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="entrada" radius={[4, 4, 0, 0]}>
                  {data.cashflow.slice(-6).map((_, index) => <Cell key={index} fill={index === 5 ? "var(--ai)" : "var(--muted-foreground)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
