import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, Download, Plus, Search } from "lucide-react";
import { Card, PageHeader, Stat, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";

type ReceivablesResponse = {
  stats: {
    total: string;
    dueIn7Days: string;
    delinquencyRate: string;
    receivedMonth: string;
  };
  items: Array<{
    id: string;
    cliente: string;
    valor: number;
    venc: string;
    status: string;
    origem: string;
    canal: string;
  }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const Route = createFileRoute("/contas-a-receber")({
  head: () => ({ meta: [{ title: "Contas a Receber · Veridia" }] }),
  component: Page
});

function Page() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounts-receivable"],
    queryFn: () => apiRequest<ReceivablesResponse>("/accounts-receivable")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando contas a receber..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar as contas a receber." /></div>;
  }

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
        <Stat label="Total a receber" value={data.stats.total} accent="success" icon={<ArrowDownLeft className="size-4" />} />
        <Stat label="Vence em 7 dias" value={data.stats.dueIn7Days} accent="info" />
        <Stat label="Inadimplência" value={data.stats.delinquencyRate} accent="warning" />
        <Stat label="Recebido (mês)" value={data.stats.receivedMonth} accent="ai" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input placeholder="Buscar cliente..." className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              {["Cliente", "Valor", "Vencimento", "Status", "Canal", "Origem"].map((header) => <th key={header} className="text-left px-4 py-2 font-medium">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3 font-medium">{item.cliente}</td>
                <td className="px-4 py-3 tabular-nums">{money.format(item.valor)}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatDate(item.venc)}</td>
                <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{item.canal}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.origem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
