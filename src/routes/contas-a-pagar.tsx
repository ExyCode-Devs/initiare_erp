import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Download, Filter, Plus, Search } from "lucide-react";
import { useEffect, useState } from 'react';
import { Card, ConfidenceBar, PageHeader, StatusBadge, Stat } from "@/components/app/primitives";
import type { ContaAPagar } from "../types/contas";

export const Route = createFileRoute("/contas-a-pagar")({
  head: () => ({ meta: [{ title: "Contas a Pagar · Veridia" }] }),
  component: Page,
});

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Page() {
  const [rows, setRows] = useState<ContaAPagar[]>([]);

  const now = new Date();
  const total = rows.reduce((acc, r) => acc + Number(r.valor || 0), 0);
  const venceEm7Dias = rows
    .filter((r) => {
      const d = new Date(r.vencimento);
      const diffMs = d.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    })
    .reduce((acc, r) => acc + Number(r.valor || 0), 0);
  const atrasados = rows.filter((r) => new Date(r.vencimento).getTime() < now.getTime()).length;
  const programadoIA = rows.filter((r) => r.status !== "Exceção").length;

  useEffect(() => {
    let mounted = true;

    const fetchContas = async () => {
      try {
        const res = await fetch('/api/webhooks/invoices');
        if (!res.ok) return;
        const data: ContaAPagar[] = await res.json();
        if (!mounted) return;
        setRows(data.filter((o) => Number(o.valor) > 0));
      } catch (err) {
        console.error('fetch contas error', err);
      }
    };

    fetchContas();
    const id = setInterval(fetchContas, 5000); // poll every 5s for dev convenience
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Contas a pagar"
        desc="Pipeline de pagamentos · 43 programados automaticamente pela IA."
        actions={
          <>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-[12.5px] hover:bg-accent"><Download className="size-3.5" /> Exportar</button>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90"><Plus className="size-3.5" /> Novo título</button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total a pagar" value={fmt.format(total)} accent="warning" icon={<ArrowUpRight className="size-4" />} />
        <Stat label="Vence em 7 dias" value={fmt.format(venceEm7Dias)} accent="info" />
        <Stat label="Programado IA" value={String(programadoIA)} accent="ai" />
        <Stat label="Atrasados" value={String(atrasados)} accent="warning" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input placeholder="Buscar fornecedor…" className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-[12.5px] focus:outline-none focus:border-border-strong" />
          </div>
          <button className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background text-[12px] hover:bg-accent"><Filter className="size-3.5" /> Filtros</button>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left px-4 py-2 font-medium">Fornecedor</th>
              <th className="text-left px-4 py-2 font-medium">Valor</th>
              <th className="text-left px-4 py-2 font-medium">Vencimento</th>
              <th className="text-left px-4 py-2 font-medium">Categoria</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium w-40">Confiança</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma conta recebida ainda. Envie um webhook para <code>/api/webhooks/invoices</code> e aguarde até 5s.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-3 font-medium">{r.fornecedor}</td>
                <td className="px-4 py-3 tabular-nums">{fmt.format(r.valor)}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{new Date(r.vencimento).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.categoria}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3"><ConfidenceBar value={r.confianca} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
