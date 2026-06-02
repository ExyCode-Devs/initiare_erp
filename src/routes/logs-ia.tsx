import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, CheckCircle2, CircleAlert, Copy, Filter, Search, Terminal, X } from "lucide-react";
import { Card, ConfidenceBar, PageHeader } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type AiLogsResponse = {
  items: Array<{
    id: string;
    time: string;
    input: string;
    action: string;
    confidence: number;
    status: "ok" | "warn" | "err";
    parsedPayload: Record<string, unknown>;
    justification: string;
  }>;
};

export const Route = createFileRoute("/logs-ia")({
  head: () => ({ meta: [{ title: "Logs IA · Veridia" }] }),
  component: LogsIA
});

function LogsIA() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ai-logs"],
    queryFn: () => apiRequest<AiLogsResponse>("/ai/logs")
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando logs da IA..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar os logs da IA." /></div>;
  }

  const selected = data.items.find((item) => item.id === selectedId) ?? data.items[0];

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8">
      <PageHeader
        title="Logs IA"
        desc="Observabilidade total das decisões do modelo. Entrada original, interpretação e ação executada."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={cn("lg:col-span-12", selected && "xl:col-span-8")}>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/60">
              <Terminal className="size-3.5 text-muted-foreground" />
              <span className="text-[12px] font-mono text-muted-foreground">stream://ai-decisions/live</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <input placeholder="Filtrar logs..." className="h-7 pl-7 pr-2 rounded bg-background border border-border text-[11.5px] focus:outline-none focus:border-border-strong w-48" />
                </div>
                <button className="h-7 px-2 rounded border border-border text-[11.5px] inline-flex items-center gap-1 hover:bg-accent">
                  <Filter className="size-3" /> Status
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] font-mono">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-4 py-2 font-medium">Hora</th>
                    <th className="text-left px-4 py-2 font-medium">Entrada</th>
                    <th className="text-left px-4 py-2 font-medium">Ação</th>
                    <th className="text-left px-4 py-2 font-medium w-40">Confiança</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => setSelectedId(item.id)}
                      className={cn("border-b border-border last:border-0 cursor-pointer hover:bg-accent/50", selected?.id === item.id && "bg-ai/5")}
                    >
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">{item.time}</td>
                      <td className="px-4 py-2 max-w-[280px] truncate text-foreground/90">{item.input}</td>
                      <td className="px-4 py-2 text-foreground/90">{item.action}</td>
                      <td className="px-4 py-2"><ConfidenceBar value={item.confidence} /></td>
                      <td className="px-4 py-2">
                        {item.status === "ok" ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3" /> ok</span> : null}
                        {item.status === "warn" ? <span className="inline-flex items-center gap-1 text-warning"><CircleAlert className="size-3" /> warn</span> : null}
                        {item.status === "err" ? <span className="inline-flex items-center gap-1 text-destructive"><CircleAlert className="size-3" /> err</span> : null}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {selected ? (
          <motion.aside initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-4">
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-ai" />
                  <span className="text-[13px] font-semibold">Decisão IA</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
              </div>
              <div className="p-4 space-y-4 font-mono text-[11.5px]">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between font-sans">
                    Texto original
                    <button className="text-muted-foreground hover:text-foreground"><Copy className="size-3" /></button>
                  </div>
                  <div className="p-3 rounded bg-background border border-border">{selected.input}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-sans">JSON interpretado</div>
                  <pre className="p-3 rounded bg-background border border-border overflow-x-auto leading-relaxed text-[11px]">
                    {JSON.stringify(selected.parsedPayload, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-sans">Decisão tomada</div>
                  <div className="p-3 rounded bg-ai/8 border border-ai/20 text-ai">{selected.action}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-sans">Justificativa</div>
                  <div className="p-3 rounded bg-background border border-border text-foreground/90 leading-relaxed">{selected.justification}</div>
                </div>
              </div>
            </Card>
          </motion.aside>
        ) : null}
      </div>
    </div>
  );
}
