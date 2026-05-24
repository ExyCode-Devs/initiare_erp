import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, CircleAlert, Equal, RefreshCw, X } from "lucide-react";
import { Card, ConfidenceBar, PageHeader, Stat } from "@/components/app/primitives";
import { conciliacaoRows } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conciliacao")({
  head: () => ({ meta: [{ title: "Conciliação · Veridia" }] }),
  component: Conciliacao,
});

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Conciliacao() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Conciliação bancária"
        desc="Match automático entre extratos e lançamentos. Você revisa apenas o que diverge."
        actions={
          <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-[12.5px] hover:bg-accent">
            <RefreshCw className="size-3.5" /> Sincronizar agora
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Conciliado" value="92%" accent="ai" />
        <Stat label="Transações conciliadas" value="1.418" accent="success" />
        <Stat label="Pendências" value="64" accent="warning" />
        <Stat label="Divergências" value="9" accent="destructive" as any />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-card/60">
          <div className="px-4 py-2.5 border-r border-border">Extrato bancário</div>
          <div className="px-4 py-2.5">Lançamento financeiro</div>
        </div>

        {conciliacaoRows.map((r, i) => {
          const matched = r.match > 0;
          const perfect = r.match >= 0.98;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-2 border-b border-border last:border-0 hover:bg-accent/30 transition-colors group"
            >
              {/* Bank */}
              <div className="px-4 py-3.5 border-r border-border flex items-center gap-3">
                <div className="size-8 rounded-md bg-muted grid place-items-center text-[10px] font-semibold text-muted-foreground shrink-0">BR</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium">{r.bank.desc}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{r.bank.date}</div>
                </div>
                <div className={cn("text-[13px] font-semibold tabular-nums", r.bank.value < 0 ? "text-destructive" : "text-success")}>
                  {fmt.format(r.bank.value)}
                </div>
              </div>

              {/* Match arrow + book */}
              <div className="px-4 py-3.5 flex items-center gap-3 relative">
                <div className={cn("absolute -left-3 top-1/2 -translate-y-1/2 size-6 rounded-full grid place-items-center ring-4 ring-card z-10",
                  perfect ? "bg-success text-success-foreground" :
                  matched ? "bg-warning text-warning-foreground" :
                  "bg-destructive text-destructive-foreground"
                )}>
                  {perfect ? <Equal className="size-3" /> : matched ? <ArrowRight className="size-3" /> : <X className="size-3" />}
                </div>
                {matched ? (
                  <>
                    <div className="flex-1 min-w-0 pl-4">
                      <div className="text-[12.5px] font-medium">{r.book.desc}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-2">
                        {r.book.date}
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]",
                          perfect ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                        )}>
                          {perfect ? <CheckCircle2 className="size-2.5" /> : <CircleAlert className="size-2.5" />}
                          {perfect ? "Match exato" : `Δ ${fmt.format(Math.abs(r.bank.value - r.book.value))}`}
                        </span>
                      </div>
                    </div>
                    <div className="w-32"><ConfidenceBar value={r.match} /></div>
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
