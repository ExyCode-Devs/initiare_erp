import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Brain, Building2, ChevronRight, Plug, Settings as SettingsIcon, Shield, Users, Zap } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import type { AsaasSettingsResponse, OmieSettingsResponse } from "@/lib/api-types";
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
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<SettingsResponse>("/settings")
  });
  const omieQuery = useQuery({
    queryKey: ["omie-settings"],
    queryFn: () => apiRequest<OmieSettingsResponse>("/settings/integrations/omie")
  });
  const asaasQuery = useQuery({
    queryKey: ["asaas-settings"],
    queryFn: () => apiRequest<AsaasSettingsResponse>("/settings/integrations/asaas")
  });
  const [active, setActive] = useState("integracoes");
  const [draftValues, setDraftValues] = useState<Record<string, { appKey: string; appSecret: string; baseUrl: string; enabled: boolean }>>({});
  const [asaasDraftValues, setAsaasDraftValues] = useState<Record<string, { apiKey: string; webhookAuthToken: string; baseUrl: string; enabled: boolean }>>({});

  const refreshOmie = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["omie-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["asaas-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["settings"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["asaas-payments"] }),
      queryClient.invalidateQueries({ queryKey: ["asaas-webhooks"] })
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (input: { environment: "HOMOLOG" | "PRODUCTION"; appKey: string; appSecret: string; baseUrl: string; enabled: boolean }) =>
      apiRequest(`/settings/integrations/omie/${input.environment}`, {
        method: "PUT",
        body: input
      }),
    onSuccess: refreshOmie
  });

  const testMutation = useMutation({
    mutationFn: (environment: "HOMOLOG" | "PRODUCTION") =>
      apiRequest(`/settings/integrations/omie/${environment}/test`, {
        method: "POST"
      }),
    onSuccess: refreshOmie
  });

  const syncMutation = useMutation({
    mutationFn: (environment: "HOMOLOG" | "PRODUCTION") =>
      apiRequest(`/settings/integrations/omie/${environment}/sync-catalog`, {
        method: "POST"
      }),
    onSuccess: refreshOmie
  });
  const saveAsaasMutation = useMutation({
    mutationFn: (input: { environment: "SANDBOX" | "PRODUCTION"; apiKey: string; webhookAuthToken: string; baseUrl: string; enabled: boolean }) =>
      apiRequest(`/settings/integrations/asaas/${input.environment}`, {
        method: "PUT",
        body: input
      }),
    onSuccess: refreshOmie
  });
  const testAsaasMutation = useMutation({
    mutationFn: (environment: "SANDBOX" | "PRODUCTION") =>
      apiRequest(`/settings/integrations/asaas/${environment}/test`, {
        method: "POST"
      }),
    onSuccess: refreshOmie
  });
  const syncAsaasMutation = useMutation({
    mutationFn: (environment: "SANDBOX" | "PRODUCTION") =>
      apiRequest(`/settings/integrations/asaas/${environment}/sync`, {
        method: "POST"
      }),
    onSuccess: refreshOmie
  });

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
              {omieQuery.data?.environments.map((environment) => {
                const values = draftValues[environment.environment] ?? {
                  appKey: "",
                  appSecret: "",
                  baseUrl: environment.baseUrl,
                  enabled: environment.enabled
                };

                return (
                  <Card key={environment.id} className="p-4 md:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[13.5px] font-medium">OMIE {environment.environment === "HOMOLOG" ? "Homologacao" : "Producao"}</div>
                        <div className="text-[12px] text-muted-foreground">
                          Status {environment.lastHealthcheckStatus.toLowerCase()}, ultimo sync {environment.lastSyncAt ? new Date(environment.lastSyncAt).toLocaleString("pt-BR") : "nunca"}.
                        </div>
                      </div>
                      <span className={cn("text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md border", environment.enabled ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border")}>
                        <span className="size-1.5 rounded-full bg-current" /> {environment.enabled ? "Ativa" : "Pausada"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        value={values.baseUrl}
                        onChange={(event) =>
                          setDraftValues((current) => ({
                            ...current,
                            [environment.environment]: { ...values, baseUrl: event.target.value }
                          }))
                        }
                        className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                        placeholder="Base URL"
                      />
                      <label className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px] inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={values.enabled}
                          onChange={(event) =>
                            setDraftValues((current) => ({
                              ...current,
                              [environment.environment]: { ...values, enabled: event.target.checked }
                            }))
                          }
                        />
                        Habilitar integracao
                      </label>
                      <input
                        value={values.appKey}
                        onChange={(event) =>
                          setDraftValues((current) => ({
                            ...current,
                            [environment.environment]: { ...values, appKey: event.target.value }
                          }))
                        }
                        className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                        placeholder={environment.hasAppKey ? "App Key salvo, preencha para trocar" : "App Key"}
                      />
                      <input
                        value={values.appSecret}
                        onChange={(event) =>
                          setDraftValues((current) => ({
                            ...current,
                            [environment.environment]: { ...values, appSecret: event.target.value }
                          }))
                        }
                        className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                        placeholder={environment.hasAppSecret ? "App Secret salvo, preencha para trocar" : "App Secret"}
                      />
                    </div>

                    {environment.lastError ? (
                      <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                        {environment.lastError}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => saveMutation.mutate({ environment: environment.environment, ...values })}
                        disabled={saveMutation.isPending}
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => testMutation.mutate(environment.environment)}
                        disabled={testMutation.isPending}
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                      >
                        Testar conexao
                      </button>
                      <button
                        onClick={() => syncMutation.mutate(environment.environment)}
                        disabled={syncMutation.isPending}
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                      >
                        Sincronizar catalogos
                      </button>
                    </div>
                  </Card>
                );
              })}
              {asaasQuery.data?.environments.map((environment) => {
                const values = asaasDraftValues[environment.environment] ?? {
                  apiKey: "",
                  webhookAuthToken: "",
                  baseUrl: environment.baseUrl,
                  enabled: environment.enabled
                };

                return (
                  <Card key={environment.id} className="p-4 md:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[13.5px] font-medium">ASAAS {environment.environment === "SANDBOX" ? "Sandbox" : "Producao"}</div>
                        <div className="text-[12px] text-muted-foreground">
                          Status {environment.lastHealthcheckStatus.toLowerCase()}, ultimo sync {environment.lastSyncAt ? new Date(environment.lastSyncAt).toLocaleString("pt-BR") : "nunca"}.
                        </div>
                      </div>
                      <span className={cn("text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md border", environment.enabled ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border")}>
                        <span className="size-1.5 rounded-full bg-current" /> {environment.enabled ? "Ativa" : "Pausada"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        value={values.baseUrl}
                        onChange={(event) =>
                          setAsaasDraftValues((current) => ({
                            ...current,
                            [environment.environment]: { ...values, baseUrl: event.target.value }
                          }))
                        }
                        className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                        placeholder="Base URL"
                      />
                      <label className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px] inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={values.enabled}
                          onChange={(event) =>
                            setAsaasDraftValues((current) => ({
                              ...current,
                              [environment.environment]: { ...values, enabled: event.target.checked }
                            }))
                          }
                        />
                        Habilitar integracao
                      </label>
                      <input
                        value={values.apiKey}
                        onChange={(event) =>
                          setAsaasDraftValues((current) => ({
                            ...current,
                            [environment.environment]: { ...values, apiKey: event.target.value }
                          }))
                        }
                        className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                        placeholder={environment.hasApiKey ? "API Key salva, preencha para trocar" : "API Key"}
                      />
                      <input
                        value={values.webhookAuthToken}
                        onChange={(event) =>
                          setAsaasDraftValues((current) => ({
                            ...current,
                            [environment.environment]: { ...values, webhookAuthToken: event.target.value }
                          }))
                        }
                        className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                        placeholder={environment.hasWebhookToken ? "Webhook token salvo, preencha para trocar" : "Webhook token"}
                      />
                    </div>

                    {environment.lastError ? (
                      <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                        {environment.lastError}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => saveAsaasMutation.mutate({ environment: environment.environment, ...values })}
                        disabled={saveAsaasMutation.isPending}
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => testAsaasMutation.mutate(environment.environment)}
                        disabled={testAsaasMutation.isPending}
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                      >
                        Testar conexao
                      </button>
                      <button
                        onClick={() => syncAsaasMutation.mutate(environment.environment)}
                        disabled={syncAsaasMutation.isPending}
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                      >
                        Sincronizar dados
                      </button>
                    </div>
                  </Card>
                );
              })}
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
