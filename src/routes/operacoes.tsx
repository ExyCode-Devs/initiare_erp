import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar, ChevronDown, Download, Filter, Plus, Search, SlidersHorizontal, Tag, Users,
} from "lucide-react";
import { Card, ConfidenceBar, FilterButton, PageHeader, StatusBadge, Toolbar } from "@/components/app/primitives";
import { operations } from "@/lib/mock-data";

export const Route = createFileRoute("/operacoes")({
  head: () => ({ meta: [{ title: "Operações · Veridia" }] }),
  component: Operacoes,
});

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function Operacoes() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8">
      <PageHeader
        title="Operações"
        desc="Central operacional financeira. Cada linha é processada, classificada e validada pela IA."
        actions={
          <>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-[12.5px] hover:bg-accent">
              <Download className="size-3.5" /> Exportar
            </button>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90">
              <Plus className="size-3.5" /> Nova operação
            </button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { l: "Total no período", v: "2.418" },
          { l: "Processadas IA", v: "2.241" },
          { l: "Em revisão", v: "104" },
          { l: "Exceções", v: "73" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-border bg-card p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="text-[20px] font-semibold tabular-nums mt-1">{s.v}</div>
          </div>
        ))}
      </div>

      <Toolbar>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input placeholder="Buscar por fornecedor, ID, valor…" className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
        </div>
        <FilterButton icon={<Tag className="size-3.5" />} label="Status:" value="Todos" />
        <FilterButton icon={<Users className="size-3.5" />} label="Responsável:" value="Qualquer" />
        <FilterButton icon={<Calendar className="size-3.5" />} label="Período:" value="Últimos 30d" />
        <FilterButton icon={<Filter className="size-3.5" />} label="Categoria" />
        <button className="ml-auto h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background text-[12px] hover:bg-accent">
          <SlidersHorizontal className="size-3.5" /> Colunas
        </button>
      </Toolbar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                {["", "ID", "Fornecedor", "Valor", "Vencimento", "Categoria", "Status", "Origem", "Confiança IA", "Responsável"].map((h) => (
                  <th key={h} className="font-medium text-left px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">{h} {h && h !== "" && <ChevronDown className="size-3 opacity-40" />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operations.map((op, i) => (
                <motion.tr
                  key={op.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                >
                  <td className="px-3 py-2.5"><input type="checkbox" className="size-3.5 rounded accent-foreground" /></td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{op.id}</td>
                  <td className="px-3 py-2.5 font-medium">{op.fornecedor}</td>
                  <td className="px-3 py-2.5 tabular-nums">{fmt.format(op.valor)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{fmtDate(op.vencimento)}</td>
                  <td className="px-3 py-2.5"><span className="text-muted-foreground">{op.categoria}</span></td>
                  <td className="px-3 py-2.5"><StatusBadge status={op.status} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{op.origem}</td>
                  <td className="px-3 py-2.5 w-40"><ConfidenceBar value={op.confianca} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`size-5 rounded-full grid place-items-center text-[9px] font-semibold ${op.responsavel === "IA" ? "bg-ai/15 text-ai" : "bg-info/15 text-info"}`}>
                        {op.responsavel === "IA" ? "AI" : op.responsavel.slice(0,2).toUpperCase()}
                      </div>
                      <span className="text-muted-foreground">{op.responsavel}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-[11.5px] text-muted-foreground">
          <span>Mostrando 1–10 de 2.418</span>
          <div className="flex items-center gap-1.5">
            <button className="h-7 px-2 rounded border border-border hover:bg-accent">Anterior</button>
            <button className="h-7 px-2.5 rounded bg-foreground text-background">1</button>
            <button className="h-7 px-2 rounded border border-border hover:bg-accent">2</button>
            <button className="h-7 px-2 rounded border border-border hover:bg-accent">3</button>
            <button className="h-7 px-2 rounded border border-border hover:bg-accent">Próxima</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
