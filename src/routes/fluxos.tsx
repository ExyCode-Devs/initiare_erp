import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Mail, Database, Workflow as WfIcon, Bot, FileText, Plus } from "lucide-react";
import { Card, PageHeader, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";

type FlowsResponse = {
  items: Array<{ id: string; name: string; desc: string; runs: number; status: "active" | "paused"; steps: string[] }>;
};

const stepIcons: Record<string, any> = { Email: Mail, IA: Bot, Aprovar: FileText, Pagar: WfIcon, Banco: Database, Match: WfIcon, Lancar: FileText, Notificar: Mail, Trigger: WfIcon, "IA Regua": Bot, Enviar: Mail, NF: FileText, Validar: FileText };

export const Route = createFileRoute("/fluxos")({
  head: () => ({ meta: [{ title: "Fluxos · Veridia" }] }),
  component: Page
});

function Page() {
  if (import.meta.env.PROD) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Fluxos hidden in production." /></div>;
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["flows"],
    queryFn: () => apiRequest<FlowsResponse>("/flows")
  });

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando fluxos..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar os fluxos." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Fluxos"
        desc="Pipelines operacionais que conectam dados, IA e ações."
        actions={<button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium"><Plus className="size-3.5" /> Novo fluxo</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.items.map((item) => (
          <Card key={item.id} className="p-5 hover:border-border-strong transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-[14.5px] font-semibold tracking-tight">{item.name}</div>
                <div className="text-[12.5px] text-muted-foreground mt-1">{item.desc}</div>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <div className="mt-5 flex items-center gap-1.5 overflow-x-auto py-2">
              {item.steps.map((step, index) => {
                const Icon = stepIcons[step] || WfIcon;
                return (
                  <div key={`${item.id}-${step}-${index}`} className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card/60">
                      <Icon className="size-3.5 text-ai" />
                      <span className="text-[12px]">{step}</span>
                    </div>
                    {index < item.steps.length - 1 ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">{item.runs.toLocaleString("pt-BR")} execuções</span>
              <button className="text-foreground hover:underline">Editar fluxo →</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
