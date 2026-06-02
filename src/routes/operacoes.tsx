import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  Download,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Users
} from "lucide-react";
import { Card, ConfidenceBar, FilterButton, PageHeader, StatusBadge, Toolbar } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

type OperationsResponse = {
  stats: {
    total: number;
    processedByAi: number;
    inReview: number;
    exceptions: number;
  };
  items: Array<{
    id: string;
    reference: string;
    fornecedor: string;
    valor: number;
    vencimento: string;
    categoria: string;
    status: string;
    origem: string;
    confianca: number;
    responsavel: string;
  }>;
};

export const Route = createFileRoute("/operacoes")({
  head: () => ({ meta: [{ title: "Operacoes · Veridia" }] }),
  component: Operacoes
});

function Operacoes() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["operations"],
    queryFn: () => apiRequest<OperationsResponse>("/operations")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando operações..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar as operações." /></div>;
  }

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total no período</div>
          <div className="text-[20px] font-semibold tabular-nums mt-1">{data.stats.total}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Processadas IA</div>
          <div className="text-[20px] font-semibold tabular-nums mt-1">{data.stats.processedByAi}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Em revisão</div>
          <div className="text-[20px] font-semibold tabular-nums mt-1">{data.stats.inReview}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Exceções</div>
          <div className="text-[20px] font-semibold tabular-nums mt-1">{data.stats.exceptions}</div>
        </div>
      </div>

      <Toolbar>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input placeholder="Buscar por fornecedor, ID, valor..." className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
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
                {["", "ID", "Fornecedor", "Valor", "Vencimento", "Categoria", "Status", "Origem", "Confiança IA", "Responsável"].map((header) => (
                  <th key={header} className="font-medium text-left px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {header} {header ? <ChevronDown className="size-3 opacity-40" /> : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                >
                  <td className="px-3 py-2.5"><input type="checkbox" className="size-3.5 rounded accent-foreground" /></td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{item.reference}</td>
                  <td className="px-3 py-2.5 font-medium">{item.fornecedor}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatCurrency(item.valor)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatDate(item.vencimento)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.categoria}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={item.status} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.origem}</td>
                  <td className="px-3 py-2.5 w-40"><ConfidenceBar value={item.confianca} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.responsavel}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
