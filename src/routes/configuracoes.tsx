import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Brain, Building2, ChevronRight, Plug, Settings as SettingsIcon, Shield, Users, Zap } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type SettingsResponse = {
  sections: Array<{ id: string; label: string; icon: keyof typeof iconMap }>;
  company: {
    name: string;
    domain: string;
    companiesCount: number;
  };
  integrations: Array<{ id: string; name: string; status: "connected" | "available"; desc: string }>;
  ai: Array<{ l: string; v: string; hint?: string }>;
};

const iconMap = {
  Building2,
  Users,
  Plug,
  Brain,
  Zap,
  Bell,
  Shield
};

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configuracoes · Veridia" }] }),
  component: Page
});

function Page() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<SettingsResponse>("/settings")
  });
  const [active, setActive] = useState("integracoes");

  if (isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando configurações..." /></div>;
  }

  if (isError || !data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar as configurações." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8">
      <PageHeader title="Configurações" desc="Personalize sua operação financeira inteligente" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3">
          <Card className="p-2">
            {data.sections.map((section) => {
              const Icon = iconMap[section.icon];
              return (
                <button
                  key={section.id}
                  onClick={() => setActive(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors",
                    active === section.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-left">{section.label}</span>
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
            <h2 className="text-[20px] font-semibold tracking-tight">{data.sections.find((section) => section.id === active)?.label}</h2>
            <p className="text-[13px] text-muted-foreground mt-1">Gerencie todos os parâmetros desta área.</p>
          </Card>

          {active === "integracoes" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.integrations.map((item) => (
                <Card key={item.id} className="p-4 flex items-center gap-4">
                  <div className="size-10 rounded-md bg-muted grid place-items-center font-semibold text-[12px]">{item.name.slice(0, 2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium">{item.name}</div>
                    <div className="text-[12px] text-muted-foreground">{item.desc}</div>
                  </div>
                  {item.status === "connected" ? (
                    <span className="text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success border border-success/20">
                      <span className="size-1.5 rounded-full bg-success" /> Conectado
                    </span>
                  ) : (
                    <button className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent">Conectar</button>
                  )}
                </Card>
              ))}
            </div>
          ) : null}

          {active === "ia" ? (
            <Card className="p-6 space-y-5">
              {data.ai.map((item) => (
                <div key={item.l} className="flex items-start justify-between gap-6 pb-5 border-b border-border last:border-0 last:pb-0">
                  <div>
                    <div className="text-[13.5px] font-medium">{item.l}</div>
                    {item.hint ? <div className="text-[12px] text-muted-foreground mt-0.5">{item.hint}</div> : null}
                  </div>
                  <button className="h-8 px-3 rounded-md border border-border bg-background text-[12.5px] hover:bg-accent shrink-0">{item.v}</button>
                </div>
              ))}
            </Card>
          ) : null}

          {active === "empresa" ? (
            <Card className="p-6 space-y-5">
              <div>
                <div className="text-[13.5px] font-medium">Empresa principal</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{data.company.name}</div>
              </div>
              <div>
                <div className="text-[13.5px] font-medium">Domínio</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{data.company.domain}</div>
              </div>
              <div>
                <div className="text-[13.5px] font-medium">Empresas gerenciadas</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{data.company.companiesCount}</div>
              </div>
            </Card>
          ) : null}

          {active !== "integracoes" && active !== "ia" && active !== "empresa" ? (
            <Card className="p-12 text-center">
              <div className="size-12 rounded-full bg-muted grid place-items-center mx-auto mb-4">
                <SettingsIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="text-[14px] font-medium">Em breve</div>
              <div className="text-[12.5px] text-muted-foreground mt-1">Esta seção está sendo construída.</div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
