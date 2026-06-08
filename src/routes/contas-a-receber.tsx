import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, Download, Plus, Search } from "lucide-react";
import { Card, PageHeader, Stat, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import type { AsaasPaymentsResponse } from "@/lib/api-types";
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
  const asaasQuery = useQuery({
    queryKey: ["asaas-payments"],
    queryFn: () => apiRequest<AsaasPaymentsResponse>("/asaas/payments")
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

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <div>
            <div className="text-[13px] font-medium">ASAAS</div>
            <div className="text-[12px] text-muted-foreground">Cobrancas, pagamentos e webhooks sincronizados.</div>
          </div>
          {asaasQuery.data?.latestWebhook ? (
            <div className="text-[11px] text-muted-foreground">
              Ultimo webhook {formatDate(asaasQuery.data.latestWebhook.createdAt)}
            </div>
          ) : null}
        </div>

        {asaasQuery.isLoading ? (
          <div className="p-4"><InlineState label="Carregando dados do ASAAS..." /></div>
        ) : asaasQuery.isError || !asaasQuery.data ? (
          <div className="p-4"><InlineError label="Nao foi possivel carregar dados do ASAAS." /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 px-4 py-4 border-b border-border">
              <Stat label="Cobrancas" value={String(asaasQuery.data.stats.charges)} accent="ai" />
              <Stat label="Pagas" value={String(asaasQuery.data.stats.paid)} accent="success" />
              <Stat label="Vencidas" value={String(asaasQuery.data.stats.overdue)} accent="warning" />
              <Stat label="Liquido" value={money.format(asaasQuery.data.stats.netReceived)} accent="info" />
              <Stat label="Taxas" value={money.format(asaasQuery.data.stats.fees)} accent="warning" />
              <Stat label="Erros" value={String(asaasQuery.data.stats.integrationErrors)} accent="warning" />
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  {["Cliente", "Valor", "Liquido", "Taxa", "Vencimento", "Pagamento", "Status", "Origem"].map((header) => <th key={header} className="text-left px-4 py-2 font-medium">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {asaasQuery.data.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3 font-medium">
                      <div>{item.customer}</div>
                      <div className="text-[11px] text-muted-foreground">{item.externalId}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{money.format(item.amount)}</td>
                    <td className="px-4 py-3 tabular-nums">{money.format(item.netAmount ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{money.format(item.fee ?? 0)}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{item.dueDate ? formatDate(item.dueDate) : "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{item.paymentDate ? formatDate(item.paymentDate) : "-"}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{item.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
