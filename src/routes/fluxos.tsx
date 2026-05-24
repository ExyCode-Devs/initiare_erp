import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Mail, Database, Workflow as WfIcon, Bot, FileText, Plus } from "lucide-react";
import { Card, PageHeader, StatusBadge } from "@/components/app/primitives";

export const Route = createFileRoute("/fluxos")({
  head: () => ({ meta: [{ title: "Fluxos · Veridia" }] }),
  component: Page,
});

const flows = [
  { name: "Captura → Classificação → Pagamento", desc: "Email/DDA → IA Classifier → Aprovação → Pagamento programado", runs: 1842, status: "active", steps: ["Email", "IA", "Aprovar", "Pagar"] },
  { name: "Recebimento → Conciliação → Lançamento", desc: "PIX/TED → Match IA → Lançamento contábil → Notificação cliente", runs: 1218, status: "active", steps: ["Banco", "Match", "Lançar", "Notificar"] },
  { name: "Cobrança inteligente", desc: "Vencimento → Régua adaptativa → Cobrança automatizada", runs: 412, status: "active", steps: ["Trigger", "IA Régua", "Enviar"] },
  { name: "Reconciliação de NFs", desc: "NF emitida → Match com lançamento → SPED ready", runs: 624, status: "paused", steps: ["NF", "Match", "Validar"] },
];

const stepIcons: Record<string, any> = { Email: Mail, IA: Bot, Aprovar: FileText, Pagar: WfIcon, Banco: Database, Match: WfIcon, Lançar: FileText, Notificar: Mail, Trigger: WfIcon, "IA Régua": Bot, Enviar: Mail, NF: FileText, Validar: FileText };

function Page() {
  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Fluxos"
        desc="Pipelines operacionais que conectam dados, IA e ações."
        actions={<button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium"><Plus className="size-3.5" /> Novo fluxo</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {flows.map((f) => (
          <Card key={f.name} className="p-5 hover:border-border-strong transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-[14.5px] font-semibold tracking-tight">{f.name}</div>
                <div className="text-[12.5px] text-muted-foreground mt-1">{f.desc}</div>
              </div>
              <StatusBadge status={f.status} />
            </div>

            <div className="mt-5 flex items-center gap-1.5 overflow-x-auto py-2">
              {f.steps.map((s, i) => {
                const Icon = stepIcons[s] || WfIcon;
                return (
                  <div key={i} className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card/60">
                      <Icon className="size-3.5 text-ai" />
                      <span className="text-[12px]">{s}</span>
                    </div>
                    {i < f.steps.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">{f.runs.toLocaleString("pt-BR")} execuções</span>
              <button className="text-foreground hover:underline">Editar fluxo →</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
