import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Brain, Building2, ChevronRight, Plug, Settings as SettingsIcon, Shield, Users, Zap } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Veridia" }] }),
  component: Page,
});

const sections = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "usuarios", label: "Usuários & Permissões", icon: Users },
  { id: "integracoes", label: "Integrações", icon: Plug },
  { id: "ia", label: "IA & Modelos", icon: Brain },
  { id: "automacao", label: "Automação", icon: Zap },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "seguranca", label: "Segurança", icon: Shield },
];

const integrations = [
  { name: "Itaú Open Finance", status: "connected", desc: "DDA · extratos · TED/PIX" },
  { name: "Bradesco", status: "connected", desc: "Extratos · DDA" },
  { name: "Stripe", status: "connected", desc: "Pagamentos online" },
  { name: "Omie", status: "connected", desc: "ERP financeiro" },
  { name: "Gmail / IMAP", status: "connected", desc: "Captura de invoices" },
  { name: "OpenAI", status: "connected", desc: "Modelo de linguagem" },
  { name: "N8N", status: "available", desc: "Orquestração de fluxos" },
  { name: "Slack", status: "available", desc: "Notificações em tempo real" },
];

function Page() {
  const [active, setActive] = useState("integracoes");

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8">
      <PageHeader title="Configurações" desc="Personalize sua operação financeira inteligente" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3">
          <Card className="p-2">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors",
                    active === s.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-left">{s.label}</span>
                  <ChevronRight className="size-3.5 opacity-50" />
                </button>
              );
            })}
          </Card>
        </aside>

        <div className="lg:col-span-9 space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <SettingsIcon className="size-4 text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Seção</span>
            </div>
            <h2 className="text-[20px] font-semibold tracking-tight">{sections.find(s => s.id === active)?.label}</h2>
            <p className="text-[13px] text-muted-foreground mt-1">Gerencie todos os parâmetros desta área.</p>
          </Card>

          {active === "integracoes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {integrations.map((it) => (
                <Card key={it.name} className="p-4 flex items-center gap-4">
                  <div className="size-10 rounded-md bg-muted grid place-items-center font-semibold text-[12px]">{it.name.slice(0,2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium">{it.name}</div>
                    <div className="text-[12px] text-muted-foreground">{it.desc}</div>
                  </div>
                  {it.status === "connected" ? (
                    <span className="text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success border border-success/20">
                      <span className="size-1.5 rounded-full bg-success" /> Conectado
                    </span>
                  ) : (
                    <button className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent">Conectar</button>
                  )}
                </Card>
              ))}
            </div>
          )}

          {active === "ia" && (
            <Card className="p-6 space-y-5">
              {[
                { l: "Modelo padrão", v: "veridia-finance-v3.2" },
                { l: "Threshold de autonomia", v: "90%", hint: "Decisões abaixo disso vão para revisão humana" },
                { l: "Modo agressivo", v: "Desativado", hint: "Permite a IA agir em casos de baixa confiança" },
                { l: "Aprendizado contínuo", v: "Ativado" },
              ].map((r) => (
                <div key={r.l} className="flex items-start justify-between gap-6 pb-5 border-b border-border last:border-0 last:pb-0">
                  <div>
                    <div className="text-[13.5px] font-medium">{r.l}</div>
                    {r.hint && <div className="text-[12px] text-muted-foreground mt-0.5">{r.hint}</div>}
                  </div>
                  <button className="h-8 px-3 rounded-md border border-border bg-background text-[12.5px] hover:bg-accent shrink-0">{r.v}</button>
                </div>
              ))}
            </Card>
          )}

          {active !== "integracoes" && active !== "ia" && (
            <Card className="p-12 text-center">
              <div className="size-12 rounded-full bg-muted grid place-items-center mx-auto mb-4">
                <SettingsIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="text-[14px] font-medium">Em breve</div>
              <div className="text-[12.5px] text-muted-foreground mt-1">Esta seção está sendo construída.</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
