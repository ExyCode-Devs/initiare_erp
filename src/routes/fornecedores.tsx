import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";

export const Route = createFileRoute("/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores · Veridia" }] }),
  component: Page,
});

const sup = [
  { name: "Amazon Web Services", cnpj: "15.436.940/0001-03", category: "Infraestrutura", spend: 184200, last: "ontem" },
  { name: "Google Workspace", cnpj: "06.990.590/0001-23", category: "Software", spend: 11800, last: "há 3 dias" },
  { name: "Stripe Payments", cnpj: "—", category: "Financeiro", spend: 42100, last: "hoje" },
  { name: "Energisa", cnpj: "08.324.196/0001-81", category: "Utilidades", spend: 50500, last: "há 2 dias" },
  { name: "RD Station", cnpj: "12.345.678/0001-90", category: "Marketing", spend: 34680, last: "há 1 semana" },
];

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Page() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Fornecedores"
        desc="Base reconhecida pela IA para classificação automática"
        actions={<button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium"><Plus className="size-3.5" /> Novo fornecedor</button>}
      />
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input placeholder="Buscar fornecedor…" className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              {["Fornecedor","CNPJ","Categoria","Gasto YTD","Última transação"].map(h => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sup.map((s) => (
              <tr key={s.name} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{s.cnpj}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.category}</td>
                <td className="px-4 py-3 tabular-nums">{fmt.format(s.spend)}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
