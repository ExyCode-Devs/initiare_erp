import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot, Brain, CheckCircle2, Mail, Pause, Play, Sparkles, Zap } from "lucide-react";
import { Card, PageHeader, StatusBadge } from "@/components/app/primitives";
import { automacaoCards } from "@/lib/mock-data";

export const Route = createFileRoute("/automacao")({
  head: () => ({ meta: [{ title: "Automação · Veridia" }] }),
  component: Page,
});

function Page() {
  const icons = [Sparkles, Mail, Bot, Brain, Zap, CheckCircle2];
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Automação" desc="Agentes IA executando tarefas em background. Ative, pause e monitore." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {automacaoCards.map((a, i) => {
          const Icon = icons[i];
          return (
            <motion.div key={a.title} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}>
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div className="size-10 rounded-lg bg-ai/12 text-ai grid place-items-center"><Icon className="size-5" /></div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-4 text-[14.5px] font-semibold">{a.title}</div>
                <div className="text-[12.5px] text-muted-foreground mt-1">{a.desc}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Runs</div><div className="text-[15px] font-semibold tabular-nums">{a.runs}</div></div>
                  <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Precisão</div><div className="text-[15px] font-semibold tabular-nums text-success">{a.accuracy}%</div></div>
                </div>
                <button className="mt-4 w-full h-8 rounded-md border border-border text-[12px] hover:bg-accent inline-flex items-center justify-center gap-1.5">
                  {a.status === "active" ? <><Pause className="size-3" /> Pausar</> : <><Play className="size-3" /> Ativar</>}
                </button>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
