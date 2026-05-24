import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Veridia" }] }),
  component: Page,
});

const clients = [
  { name: "Acme Industries", segment: "Indústria", revenue: 184000, status: "Ativo", since: "2023" },
  { name: "Globex Corp", segment: "Tecnologia", revenue: 122400, status: "Ativo", since: "2024" },
  { name: "Initech BR", segment: "Software", revenue: 98000, status: "Ativo", since: "2022" },
  { name: "Soylent Co", segment: "FoodTech", revenue: 54000, status: "Ativo", since: "2025" },
  { name: "Massive Dynamic", segment: "Engenharia", revenue: 412000, status: "Ativo", since: "2021" },
  { name: "Hooli", segment: "Tecnologia", revenue: 28000, status: "Pausado", since: "2024" },
];

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Page() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Clientes"
        desc="Carteira ativa · receita gerenciada pela IA"
        actions={<button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium"><Plus className="size-3.5" /> Novo cliente</button>}
      />

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input placeholder="Buscar cliente…" className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              {["Cliente","Segmento","Receita anual","Cliente desde","Status"].map(h => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.name} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-md bg-gradient-to-br from-chart-2 to-chart-4 grid place-items-center text-[10px] font-semibold text-white">{c.name.slice(0,2).toUpperCase()}</div>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.segment}</td>
                <td className="px-4 py-3 tabular-nums">{fmt.format(c.revenue)}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.since}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
