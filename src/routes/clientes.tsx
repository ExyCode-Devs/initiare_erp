import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type ClientsResponse = {
  items: Array<{
    id: string;
    name: string;
    segment: string;
    revenue: number;
    status: string;
    since: string;
  }>;
};

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Veridia" }] }),
  component: Page
});

function Page() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiRequest<ClientsResponse>("/clients")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando clientes..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar os clientes." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Clientes"
        desc="Carteira ativa com leitura real do banco."
        actions={<button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium"><Plus className="size-3.5" /> Novo cliente</button>}
      />

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input placeholder="Buscar cliente..." className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              {["Cliente", "Segmento", "Receita anual", "Cliente desde", "Status"].map((header) => <th key={header} className="text-left px-4 py-2 font-medium">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-md bg-gradient-to-br from-chart-2 to-chart-4 grid place-items-center text-[10px] font-semibold text-white">{item.name.slice(0, 2).toUpperCase()}</div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.segment}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(item.revenue)}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.since}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${item.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
