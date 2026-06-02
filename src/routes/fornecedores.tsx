import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type SuppliersResponse = {
  items: Array<{
    id: string;
    name: string;
    cnpj: string;
    category: string;
    spend: number;
    last: string;
  }>;
};

export const Route = createFileRoute("/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores · Veridia" }] }),
  component: Page
});

function Page() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiRequest<SuppliersResponse>("/suppliers")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando fornecedores..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar os fornecedores." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Fornecedores"
        desc="Base reconhecida pela IA para classificação automática."
        actions={<button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium"><Plus className="size-3.5" /> Novo fornecedor</button>}
      />
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input placeholder="Buscar fornecedor..." className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              {["Fornecedor", "CNPJ", "Categoria", "Gasto YTD", "Última transação"].map((header) => <th key={header} className="text-left px-4 py-2 font-medium">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{item.cnpj}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(item.spend)}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
