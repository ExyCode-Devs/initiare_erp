import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileBarChart, FileText, PieChart, TrendingUp } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";

type ReportsResponse = {
  items: Array<{ id: string; name: string; desc: string; updated: string }>;
};

const iconMap = {
  "DRE Mensal": FileBarChart,
  "Fluxo de Caixa Projetado": TrendingUp,
  "Despesas por Categoria": PieChart,
  "Conciliacao Bancaria": FileText,
  "Contas a Pagar/Receber": FileBarChart,
  "Performance IA": TrendingUp
} as const;

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatorios · Veridia" }] }),
  component: Page
});

function Page() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports"],
    queryFn: () => apiRequest<ReportsResponse>("/reports")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando relatórios..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar os relatórios." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Relatórios" desc="Documentos gerados automaticamente pela IA · prontos para exportar" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.items.map((item) => {
          const Icon = iconMap[item.name as keyof typeof iconMap] ?? FileBarChart;
          return (
            <Card key={item.id} className="p-5 hover:border-border-strong hover:-translate-y-0.5 transition-all group">
              <div className="size-10 rounded-lg bg-info/12 text-info grid place-items-center"><Icon className="size-5" /></div>
              <div className="mt-4 text-[14.5px] font-semibold">{item.name}</div>
              <div className="text-[12.5px] text-muted-foreground mt-1">{item.desc}</div>
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">{item.updated}</span>
                <button className="text-[12px] inline-flex items-center gap-1 hover:underline"><Download className="size-3.5" /> PDF</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
