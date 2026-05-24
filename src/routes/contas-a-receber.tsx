import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, Download, Plus, Search } from "lucide-react";
import { Card, PageHeader, Stat, StatusBadge } from "@/components/app/primitives";

export const Route = createFileRoute("/contas-a-receber")({
  head: () => ({ meta: [{ title: "Contas a Receber · Veridia" }] }),
  component: Page,
});

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const rows = [
  { cliente: "Stripe Payments", valor: 32100, venc: "26/05", status: "Conciliado", origem: "API", canal: "PIX" },
  { cliente: "Acme Industries", valor: 18400, venc: "28/05", status: "Pendente", origem: "Fatura", canal: "Boleto" },
  { cliente: "Globex Corp", valor: 24200, venc: "30/05", status: "Em revisão", origem: "Fatura", canal: "TED" },
  { cliente: "Initech BR", valor: 9800, venc: "02/06", status: "Pendente", origem: "Recorrência", canal: "PIX" },
  { cliente: "Massive Dynamic", valor: 41200, venc: "04/06", status: "Pendente", origem: "Fatura", canal: "Boleto" },
  { cliente: "Soylent Co", valor: 5400, venc: "05/06", status: "Conciliado", origem: "API", canal: "PIX" },
];

function Page() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Contas a receber"
        desc="Recebíveis programados e cobranças inteligentes pela IA."
        actions={
          <>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-[12.5px] hover:bg-accent"><Download className="size-3.5" /> Exportar</button>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90"><Plus className="size-3.5" /> Nova cobrança</button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total a receber" value="R$ 412k" accent="success" icon={<ArrowDownLeft className="size-4" />} />
        <Stat label="Vence em 7 dias" value="R$ 84k" accent="info" />
        <Stat label="Inadimplência" value="2.1%" accent="warning" />
        <Stat label="Recebido (mês)" value="R$ 1.24M" accent="ai" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input placeholder="Buscar cliente…" className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              {["Cliente","Valor","Vencimento","Status","Canal","Origem"].map(h => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3 font-medium">{r.cliente}</td>
                <td className="px-4 py-3 tabular-nums">{fmt.format(r.valor)}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.venc}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{r.canal}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.origem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
