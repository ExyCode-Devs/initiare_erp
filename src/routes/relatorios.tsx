import { createFileRoute } from "@tanstack/react-router";
import { Download, FileBarChart, FileText, PieChart, TrendingUp } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · Veridia" }] }),
  component: Page,
});

const reports = [
  { name: "DRE Mensal", desc: "Demonstrativo de Resultado consolidado", icon: FileBarChart, updated: "atualizado hoje" },
  { name: "Fluxo de Caixa Projetado", desc: "Previsão de 12 meses com IA", icon: TrendingUp, updated: "atualizado há 1h" },
  { name: "Despesas por Categoria", desc: "Distribuição mensal e tendências", icon: PieChart, updated: "atualizado hoje" },
  { name: "Conciliação Bancária", desc: "Status e divergências do período", icon: FileText, updated: "atualizado há 2h" },
  { name: "Contas a Pagar/Receber", desc: "Aging completo da carteira", icon: FileBarChart, updated: "atualizado hoje" },
  { name: "Performance IA", desc: "Métricas operacionais dos modelos", icon: TrendingUp, updated: "atualizado há 5min" },
];

function Page() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Relatórios" desc="Documentos gerados automaticamente pela IA · prontos para exportar" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.name} className="p-5 hover:border-border-strong hover:-translate-y-0.5 transition-all group">
              <div className="size-10 rounded-lg bg-info/12 text-info grid place-items-center"><Icon className="size-5" /></div>
              <div className="mt-4 text-[14.5px] font-semibold">{r.name}</div>
              <div className="text-[12.5px] text-muted-foreground mt-1">{r.desc}</div>
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">{r.updated}</span>
                <button className="text-[12px] inline-flex items-center gap-1 hover:underline"><Download className="size-3.5" /> PDF</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
