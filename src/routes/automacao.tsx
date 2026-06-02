import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot, Brain, CheckCircle2, Mail, Pause, Play, Sparkles, Zap } from "lucide-react";
import { Card, PageHeader, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";

type AutomationsResponse = {
  items: Array<{ id: string; title: string; desc: string; runs: number; accuracy: number; status: "active" | "paused" }>;
};

export const Route = createFileRoute("/automacao")({
  head: () => ({ meta: [{ title: "Automacao · Veridia" }] }),
  component: Page
});

function Page() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["automations"],
    queryFn: () => apiRequest<AutomationsResponse>("/automations")
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" }) =>
      apiRequest(`/automations/${id}`, {
        method: "PATCH",
        body: { status }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["automations"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-overview"] });
    }
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando automações..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar as automações." /></div>;
  }

  const icons = [Sparkles, Mail, Bot, Brain, Zap, CheckCircle2];

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Automação" desc="Agentes IA executando tarefas em background. Ative, pause e monitore." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.items.map((item, index) => {
          const Icon = icons[index % icons.length];
          return (
            <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div className="size-10 rounded-lg bg-ai/12 text-ai grid place-items-center"><Icon className="size-5" /></div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 text-[14.5px] font-semibold">{item.title}</div>
                <div className="text-[12.5px] text-muted-foreground mt-1">{item.desc}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Runs</div><div className="text-[15px] font-semibold tabular-nums">{item.runs}</div></div>
                  <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Precisão</div><div className="text-[15px] font-semibold tabular-nums text-success">{item.accuracy}%</div></div>
                </div>
                <button
                  onClick={() => mutation.mutate({ id: item.id, status: item.status === "active" ? "PAUSED" : "ACTIVE" })}
                  className="mt-4 w-full h-8 rounded-md border border-border text-[12px] hover:bg-accent inline-flex items-center justify-center gap-1.5"
                >
                  {item.status === "active" ? <><Pause className="size-3" /> Pausar</> : <><Play className="size-3" /> Ativar</>}
                </button>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
