import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, CircleAlert, Equal, RefreshCw, X } from "lucide-react";
import { Card, ConfidenceBar, PageHeader, Stat } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type ReconciliationResponse = {
  stats: {
    reconciledRate: string;
    reconciledCount: number;
    pending: number;
    divergent: number;
  };
  items: Array<{
    id: string;
    bank: { date: string; desc: string; value: number };
    book: { date: string; desc: string; value: number };
    match: number;
  }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const Route = createFileRoute("/conciliacao")({
  head: () => ({ meta: [{ title: "Conciliacao · Veridia" }] }),
  component: Conciliacao
});

function Conciliacao() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reconciliation"],
    queryFn: () => apiRequest<ReconciliationResponse>("/reconciliation")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando conciliação..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar a conciliação." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Conciliação bancária"
        desc="Match automático entre extratos e lançamentos."
        actions={
          <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-[12.5px] hover:bg-accent">
            <RefreshCw className="size-3.5" /> Sincronizar agora
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Conciliado" value={data.stats.reconciledRate} accent="ai" />
        <Stat label="Transações conciliadas" value={String(data.stats.reconciledCount)} accent="success" />
        <Stat label="Pendências" value={String(data.stats.pending)} accent="warning" />
        <Stat label="Divergências" value={String(data.stats.divergent)} accent="warning" />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-card/60">
          <div className="px-4 py-2.5 border-r border-border">Extrato bancário</div>
          <div className="px-4 py-2.5">Lançamento financeiro</div>
        </div>

        {data.items.map((item, index) => {
          const matched = item.match > 0;
          const perfect = item.match >= 0.98;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className="grid grid-cols-2 border-b border-border last:border-0 hover:bg-accent/30 transition-colors group"
            >
              <div className="px-4 py-3.5 border-r border-border flex items-center gap-3">
                <div className="size-8 rounded-md bg-muted grid place-items-center text-[10px] font-semibold text-muted-foreground shrink-0">BR</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium">{item.bank.desc}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{item.bank.date}</div>
                </div>
                <div className={cn("text-[13px] font-semibold tabular-nums", item.bank.value < 0 ? "text-destructive" : "text-success")}>
                  {money.format(item.bank.value)}
                </div>
              </div>

              <div className="px-4 py-3.5 flex items-center gap-3 relative">
                <div
                  className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 size-6 rounded-full grid place-items-center ring-4 ring-card z-10",
                    perfect ? "bg-success text-success-foreground" : matched ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"
                  )}
                >
                  {perfect ? <Equal className="size-3" /> : matched ? <ArrowRight className="size-3" /> : <X className="size-3" />}
                </div>
                {matched ? (
                  <>
                    <div className="flex-1 min-w-0 pl-4">
                      <div className="text-[12.5px] font-medium">{item.book.desc}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-2">
                        {item.book.date}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]",
                            perfect ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                          )}
                        >
                          {perfect ? <CheckCircle2 className="size-2.5" /> : <CircleAlert className="size-2.5" />}
                          {perfect ? "Match exato" : `Δ ${money.format(Math.abs(item.bank.value - item.book.value))}`}
                        </span>
                      </div>
                    </div>
                    <div className="w-32"><ConfidenceBar value={item.match} /></div>
                  </>
                ) : (
                  <div className="flex-1 pl-4">
                    <div className="text-[12.5px] text-muted-foreground italic">Sem correspondência · revisar manualmente</div>
                    <button className="mt-1 text-[11px] text-ai hover:underline">Sugerir lançamento →</button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </Card>
    </div>
  );
}
