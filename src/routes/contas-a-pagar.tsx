import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Download, Filter, Plus, Search } from "lucide-react";
import { Card, ConfidenceBar, PageHeader, Stat, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";

type PayablesResponse = {
  stats: {
    total: string;
    dueIn7Days: string;
    scheduledByAi: number;
    overdue: number;
  };
  items: Array<{
    id: string;
    fornecedor: string;
    valor: number;
    vencimento: string;
    categoria: string;
    status: string;
    confianca: number;
  }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const Route = createFileRoute("/contas-a-pagar")({
  head: () => ({ meta: [{ title: "Contas a Pagar · Veridia" }] }),
  component: Page
});

function Page() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounts-payable"],
    queryFn: () => apiRequest<PayablesResponse>("/accounts-payable"),
    refetchInterval: 15_000
  });

  if (isLoading) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineState label="Carregando contas a pagar..." />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineError label="Nao foi possivel carregar as contas a pagar." />
      </div>
    );
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Contas a pagar"
        desc="Pipeline de pagamentos com persistencia real no banco."
        actions={
          <>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-[12.5px] hover:bg-accent">
              <Download className="size-3.5" /> Exportar
            </button>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90">
              <Plus className="size-3.5" /> Novo titulo
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total a pagar" value={data.stats.total} accent="warning" icon={<ArrowUpRight className="size-4" />} />
        <Stat label="Vence em 7 dias" value={data.stats.dueIn7Days} accent="info" />
        <Stat label="Programado IA" value={String(data.stats.scheduledByAi)} accent="ai" />
        <Stat label="Atrasados" value={String(data.stats.overdue)} accent="warning" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              placeholder="Buscar fornecedor..."
              className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong"
            />
          </div>
          <button className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background text-[12px] hover:bg-accent">
            <Filter className="size-3.5" /> Filtros
          </button>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left px-4 py-2 font-medium">Fornecedor</th>
              <th className="text-left px-4 py-2 font-medium">Valor</th>
              <th className="text-left px-4 py-2 font-medium">Vencimento</th>
              <th className="text-left px-4 py-2 font-medium">Categoria</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium w-40">Confianca</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma conta recebida ainda. Envie um webhook para <code>/api/webhooks/invoices</code>.
                </td>
              </tr>
            ) : null}
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3 font-medium">{item.fornecedor}</td>
                <td className="px-4 py-3 tabular-nums">{money.format(item.valor)}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatDate(item.vencimento)}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.categoria}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <ConfidenceBar value={item.confianca} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
