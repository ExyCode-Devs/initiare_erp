import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, ChevronRight, Clock, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Card, ConfidenceBar, PageHeader, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type ExceptionItem = {
  id: string;
  code: string;
  title: string;
  desc: string;
  suggestion: string;
  confidence: number;
  severity: string;
  time: string;
  status: string;
  timeline: Array<{ t: string; text: string }>;
};

type ExceptionsResponse = {
  summary: { open: number };
  items: ExceptionItem[];
};

export const Route = createFileRoute("/excecoes")({
  head: () => ({ meta: [{ title: "Excecoes · Veridia" }] }),
  component: Excecoes
});

function Excecoes() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["exceptions"],
    queryFn: () => apiRequest<ExceptionsResponse>("/exceptions")
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "OPEN" | "APPROVED" | "REJECTED" }) =>
      apiRequest(`/exceptions/${id}`, {
        method: "PATCH",
        body: { status }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    }
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando exceções..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar as exceções." /></div>;
  }

  const selected = data.items.find((item) => item.id === selectedId) ?? data.items[0];

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8">
      <PageHeader
        title="Central de exceções"
        desc="A IA executa tudo que pode automaticamente. Você decide apenas o que importa."
        actions={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-warning/10 border border-warning/25 text-[12px] text-warning">
            <AlertTriangle className="size-3.5" />
            {data.summary.open} exceções aguardando revisão
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 xl:col-span-8 space-y-2.5">
          {data.items.map((item) => {
            const active = selected.id === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                whileHover={{ y: -1 }}
                className={cn(
                  "w-full text-left rounded-xl border bg-card p-5 transition-all",
                  active ? "border-ai/40 ring-1 ring-ai/20 shadow-elegant" : "border-border hover:border-border-strong"
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "size-10 rounded-lg grid place-items-center shrink-0",
                      item.severity === "Alta"
                        ? "bg-destructive/12 text-destructive"
                        : item.severity === "Media"
                          ? "bg-warning/12 text-warning"
                          : "bg-info/12 text-info"
                    )}
                  >
                    <AlertTriangle className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10.5px] text-muted-foreground">{item.code}</span>
                      <StatusBadge status={item.severity} />
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Clock className="size-3" /> {item.time}</span>
                    </div>
                    <div className="text-[14.5px] font-semibold tracking-tight">{item.title}</div>
                    <div className="text-[12.5px] text-muted-foreground mt-1">{item.desc}</div>
                    <div className="mt-3 p-2.5 rounded-md bg-ai/6 border border-ai/15">
                      <div className="flex items-start gap-2">
                        <Sparkles className="size-3.5 text-ai mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="text-[11px] uppercase tracking-wider text-ai/80 mb-0.5">Sugestão da IA</div>
                          <div className="text-[12.5px] text-foreground/90">{item.suggestion}</div>
                        </div>
                      </div>
                      <div className="mt-2.5"><ConfidenceBar value={item.confidence} /></div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          mutation.mutate({ id: item.id, status: "APPROVED" });
                        }}
                        className="h-7 px-2.5 rounded-md bg-success/15 text-success border border-success/25 text-[11.5px] font-medium inline-flex items-center gap-1 hover:bg-success/20"
                      >
                        <Check className="size-3" /> Aprovar
                      </button>
                      <button className="h-7 px-2.5 rounded-md border border-border text-[11.5px] hover:bg-accent inline-flex items-center gap-1">
                        Corrigir <ArrowRight className="size-3" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          mutation.mutate({ id: item.id, status: "REJECTED" });
                        }}
                        className="h-7 px-2.5 rounded-md border border-border text-[11.5px] text-muted-foreground hover:bg-accent inline-flex items-center gap-1"
                      >
                        <X className="size-3" /> Rejeitar
                      </button>
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.aside
          key={selected.id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 self-start"
        >
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Exceção</div>
                <div className="text-[16px] font-semibold tracking-tight mt-1">{selected.title}</div>
                <div className="font-mono text-[10.5px] text-muted-foreground mt-1">{selected.code}</div>
              </div>
              <StatusBadge status={selected.severity} />
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Contexto</div>
                <div className="text-[12.5px] text-foreground/90 p-2.5 rounded-md bg-muted/50 border border-border">{selected.desc}</div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Confiança IA</div>
                <ConfidenceBar value={selected.confidence} />
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Timeline da decisão</div>
                <ol className="relative border-l border-border pl-4 space-y-3 ml-1">
                  {selected.timeline.map((entry, index) => (
                    <li key={`${entry.t}-${index}`} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-ai ring-2 ring-background" />
                      <div className="text-[11px] font-mono text-muted-foreground">{entry.t}</div>
                      <div className="text-[12.5px]">{entry.text}</div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pt-3 border-t border-border flex items-center gap-2">
                <button
                  onClick={() => mutation.mutate({ id: selected.id, status: "APPROVED" })}
                  className="flex-1 h-9 rounded-md bg-foreground text-background text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                >
                  <Check className="size-3.5" /> Aprovar sugestão
                </button>
                <button className="h-9 px-3 rounded-md border border-border text-[12.5px] hover:bg-accent">Editar</button>
              </div>
            </div>
          </Card>
        </motion.aside>
      </div>
    </div>
  );
}
