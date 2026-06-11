import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Brain,
  Building2,
  ChevronRight,
  Mail,
  Plus,
  Plug,
  RefreshCcw,
  Settings as SettingsIcon,
  Shield,
  TestTube2,
  Users,
  Zap,
} from "lucide-react";
import { Card, PageHeader, SectionHeader, Stat, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { ApiError, apiRequest } from "@/lib/api";
import type {
  AsaasSettingsResponse,
  AutomationSettingsResponse,
  ChangelogPublicResponse,
  LegalEntitiesResponse,
  MailboxesResponse,
  OmieSettingsResponse,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type SettingsResponse = {
  sections: Array<{ id: string; label: string; icon: keyof typeof iconMap }>;
  company: {
    name: string;
    domain: string;
    companiesCount: number;
    replyFromName: string | null;
    replyFromEmail: string | null;
    replyToEmail: string | null;
  };
  integrations: Array<{ id: string; name: string; status: "connected" | "available"; desc: string }>;
  ai: Array<{ l: string; v: string; hint?: string }>;
};

type MailboxFormState = {
  name: string;
  host: string;
  port: string;
  tls: boolean;
  username: string;
  password: string;
  fromFilter: string;
  active: boolean;
  legalEntityId: string;
};

type AutomationSettingsFormState = {
  emailIngestEnabled: boolean;
  batchProcessingEnabled: boolean;
  autoSyncMailboxes: boolean;
  autoTestIntegrations: boolean;
  draftAutoReprocess: boolean;
  notificationDigestEnabled: boolean;
  defaultEnvironment: "HOMOLOG" | "SANDBOX";
  maxEmailsPerRun: string;
  batchIntervalMinutes: string;
};

const iconMap = {
  Building2,
  Users,
  Plug,
  Brain,
  Zap,
  Bell,
  Shield,
};

const initialMailboxForm: MailboxFormState = {
  name: "",
  host: "imap.gmail.com",
  port: "993",
  tls: true,
  username: "",
  password: "",
  fromFilter: "",
  active: true,
  legalEntityId: "",
};

const initialAutomationSettingsForm: AutomationSettingsFormState = {
  emailIngestEnabled: true,
  batchProcessingEnabled: true,
  autoSyncMailboxes: true,
  autoTestIntegrations: false,
  draftAutoReprocess: false,
  notificationDigestEnabled: true,
  defaultEnvironment: "HOMOLOG",
  maxEmailsPerRun: "10",
  batchIntervalMinutes: "15",
};

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configuracoes · Veridia" }] }),
  component: Page,
});

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Action failed.";
}

function Page() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<SettingsResponse>("/settings"),
  });
  const omieQuery = useQuery({
    queryKey: ["omie-settings"],
    queryFn: () => apiRequest<OmieSettingsResponse>("/settings/integrations/omie"),
  });
  const asaasQuery = useQuery({
    queryKey: ["asaas-settings"],
    queryFn: () => apiRequest<AsaasSettingsResponse>("/settings/integrations/asaas"),
  });
  const legalEntitiesQuery = useQuery({
    queryKey: ["legal-entities"],
    queryFn: () => apiRequest<LegalEntitiesResponse>("/settings/legal-entities"),
  });
  const mailboxesQuery = useQuery({
    queryKey: ["mailboxes"],
    queryFn: () => apiRequest<MailboxesResponse>("/mailboxes"),
  });
  const notificationsQuery = useQuery({
    queryKey: ["public-changelog"],
    queryFn: () => apiRequest<ChangelogPublicResponse>("/changelog"),
  });
  const automationSettingsQuery = useQuery({
    queryKey: ["automation-settings"],
    queryFn: () => apiRequest<AutomationSettingsResponse>("/settings/automation"),
  });
  const [active, setActive] = useState("integracoes");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [mailboxModalOpen, setMailboxModalOpen] = useState(false);
  const [draftValues, setDraftValues] = useState<
    Record<string, { appKey: string; appSecret: string; baseUrl: string; enabled: boolean }>
  >({});
  const [asaasDraftValues, setAsaasDraftValues] = useState<
    Record<string, { apiKey: string; webhookAuthToken: string; baseUrl: string; enabled: boolean }>
  >({});
  const [selectedLegalEntityId, setSelectedLegalEntityId] = useState<string>("");
  const [mailboxForm, setMailboxForm] = useState<MailboxFormState>(initialMailboxForm);
  const [automationSettingsForm, setAutomationSettingsForm] = useState<AutomationSettingsFormState>(
    initialAutomationSettingsForm,
  );
  const [companyForm, setCompanyForm] = useState({
    name: "",
    domain: "",
    replyFromName: "",
    replyFromEmail: "",
    replyToEmail: "",
  });
  const [entityForm, setEntityForm] = useState({
    legalName: "",
    tradeName: "",
    cnpj: "",
    active: true,
    defaultRecipientEmails: "",
    defaultMailboxIds: "",
    notes: "",
  });

  useEffect(() => {
    if (!selectedLegalEntityId && legalEntitiesQuery.data?.items[0]?.id) {
      setSelectedLegalEntityId(legalEntitiesQuery.data.items[0].id);
    }
  }, [legalEntitiesQuery.data, selectedLegalEntityId]);

  useEffect(() => {
    setCompanyForm({
      name: data?.company.name ?? "",
      domain: data?.company.domain ?? "",
      replyFromName: data?.company.replyFromName ?? "",
      replyFromEmail: data?.company.replyFromEmail ?? "",
      replyToEmail: data?.company.replyToEmail ?? "",
    });
  }, [data?.company]);

  useEffect(() => {
    if (!automationSettingsQuery.data) {
      return;
    }

    setAutomationSettingsForm({
      emailIngestEnabled: automationSettingsQuery.data.settings.emailIngestEnabled,
      batchProcessingEnabled: automationSettingsQuery.data.settings.batchProcessingEnabled,
      autoSyncMailboxes: automationSettingsQuery.data.settings.autoSyncMailboxes,
      autoTestIntegrations: automationSettingsQuery.data.settings.autoTestIntegrations,
      draftAutoReprocess: automationSettingsQuery.data.settings.draftAutoReprocess,
      notificationDigestEnabled: automationSettingsQuery.data.settings.notificationDigestEnabled,
      defaultEnvironment: automationSettingsQuery.data.settings.defaultEnvironment,
      maxEmailsPerRun: String(automationSettingsQuery.data.settings.maxEmailsPerRun),
      batchIntervalMinutes: String(automationSettingsQuery.data.settings.batchIntervalMinutes),
    });
  }, [automationSettingsQuery.data]);

  const selectedLegalEntity = useMemo(
    () => legalEntitiesQuery.data?.items.find((item) => item.id === selectedLegalEntityId) ?? null,
    [legalEntitiesQuery.data, selectedLegalEntityId],
  );

  useEffect(() => {
    if (!selectedLegalEntity) {
      return;
    }

    setEntityForm({
      legalName: selectedLegalEntity.legalName,
      tradeName: selectedLegalEntity.tradeName ?? "",
      cnpj: selectedLegalEntity.cnpj,
      active: selectedLegalEntity.active,
      defaultRecipientEmails: selectedLegalEntity.defaultRecipientEmails.join(", "),
      defaultMailboxIds: selectedLegalEntity.defaultMailboxIds.join(", "),
      notes: selectedLegalEntity.notes ?? "",
    });
  }, [selectedLegalEntity]);

  useEffect(() => {
    setMailboxForm((current) => ({
      ...current,
      legalEntityId: selectedLegalEntityId,
    }));
  }, [selectedLegalEntityId]);

  const selectedOmieEnvironments = useMemo(
    () => omieQuery.data?.environments.filter((item) => item.legalEntityId === selectedLegalEntityId) ?? [],
    [omieQuery.data, selectedLegalEntityId],
  );
  const selectedAsaasEnvironments = useMemo(
    () => asaasQuery.data?.environments.filter((item) => item.legalEntityId === selectedLegalEntityId) ?? [],
    [asaasQuery.data, selectedLegalEntityId],
  );
  const selectedMailboxes = useMemo(
    () =>
      mailboxesQuery.data?.items.filter(
        (item) => item.legalEntityId === selectedLegalEntityId || (!item.legalEntityId && !selectedLegalEntityId),
      ) ?? [],
    [mailboxesQuery.data, selectedLegalEntityId],
  );

  const omieConnectionCount = omieQuery.data?.environments.length ?? 0;
  const asaasConnectionCount = asaasQuery.data?.environments.length ?? 0;
  const mailboxCount = mailboxesQuery.data?.items.length ?? 0;
  const unreadNotifications = notificationsQuery.data?.items.filter((item) => item.unread) ?? [];

  const refreshSettings = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["omie-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["asaas-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["legal-entities"] }),
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] }),
      queryClient.invalidateQueries({ queryKey: ["settings"] }),
      queryClient.invalidateQueries({ queryKey: ["automation-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["public-changelog"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["asaas-payments"] }),
      queryClient.invalidateQueries({ queryKey: ["asaas-webhooks"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (input: {
      legalEntityId: string;
      environment: "HOMOLOG" | "PRODUCTION";
      appKey: string;
      appSecret: string;
      baseUrl: string;
      enabled: boolean;
    }) =>
      apiRequest(`/settings/integrations/omie/${input.environment}`, {
        method: "PUT",
        body: input,
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "OMIE connection saved." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const testMutation = useMutation({
    mutationFn: (input: { legalEntityId: string; environment: "HOMOLOG" | "PRODUCTION" }) =>
      apiRequest(`/settings/integrations/omie/${input.environment}/test`, {
        method: "POST",
        body: { legalEntityId: input.legalEntityId },
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "OMIE test completed." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (input: { legalEntityId: string; environment: "HOMOLOG" | "PRODUCTION" }) =>
      apiRequest(`/settings/integrations/omie/${input.environment}/sync-catalog`, {
        method: "POST",
        body: { legalEntityId: input.legalEntityId },
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "OMIE catalog sync finished." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const saveAsaasMutation = useMutation({
    mutationFn: (input: {
      legalEntityId: string;
      environment: "SANDBOX" | "PRODUCTION";
      apiKey: string;
      webhookAuthToken: string;
      baseUrl: string;
      enabled: boolean;
    }) =>
      apiRequest(`/settings/integrations/asaas/${input.environment}`, {
        method: "PUT",
        body: input,
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "ASAAS connection saved." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const testAsaasMutation = useMutation({
    mutationFn: (input: { legalEntityId: string; environment: "SANDBOX" | "PRODUCTION" }) =>
      apiRequest(`/settings/integrations/asaas/${input.environment}/test`, {
        method: "POST",
        body: { legalEntityId: input.legalEntityId },
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "ASAAS test completed." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const syncAsaasMutation = useMutation({
    mutationFn: (input: { legalEntityId: string; environment: "SANDBOX" | "PRODUCTION" }) =>
      apiRequest(`/settings/integrations/asaas/${input.environment}/sync`, {
        method: "POST",
        body: { legalEntityId: input.legalEntityId },
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "ASAAS sync finished." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const saveLegalEntityMutation = useMutation({
    mutationFn: (input: {
      id?: string;
      legalName: string;
      tradeName: string;
      cnpj: string;
      active: boolean;
      defaultRecipientEmails: string[];
      defaultMailboxIds: string[];
      notes: string;
    }) =>
      apiRequest(input.id ? `/settings/legal-entities/${input.id}` : "/settings/legal-entities", {
        method: input.id ? "PATCH" : "POST",
        body: {
          legalName: input.legalName,
          tradeName: input.tradeName || null,
          cnpj: input.cnpj,
          active: input.active,
          defaultRecipientEmails: input.defaultRecipientEmails,
          defaultMailboxIds: input.defaultMailboxIds,
          notes: input.notes || null,
        },
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "Legal entity saved." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const removeLegalEntityMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/settings/legal-entities/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      setSelectedLegalEntityId("");
      setFeedback({ tone: "success", message: "Legal entity removed." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const saveCompanyMutation = useMutation({
    mutationFn: (input: typeof companyForm) =>
      apiRequest<{ company: SettingsResponse["company"] }>("/settings/company", {
        method: "PATCH",
        body: {
          name: input.name,
          domain: input.domain,
          replyFromName: input.replyFromName.trim() || null,
          replyFromEmail: input.replyFromEmail.trim() || null,
          replyToEmail: input.replyToEmail.trim() || null,
        },
      }),
    onSuccess: async ({ company }) => {
      setCompanyForm({
        name: company.name,
        domain: company.domain,
        replyFromName: company.replyFromName ?? "",
        replyFromEmail: company.replyFromEmail ?? "",
        replyToEmail: company.replyToEmail ?? "",
      });
      setFeedback({ tone: "success", message: "Company settings saved." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const mailboxActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "test" | "sync" }) =>
      apiRequest(`/mailboxes/${id}/${action}`, {
        method: "POST",
      }),
    onSuccess: async (_, variables) => {
      setFeedback({
        tone: "success",
        message: variables.action === "test" ? "Mailbox test completed." : "Mailbox sync completed.",
      });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const createMailboxMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string }>("/mailboxes", {
        method: "POST",
        body: {
          name: mailboxForm.name,
          host: mailboxForm.host,
          port: Number(mailboxForm.port),
          tls: mailboxForm.tls,
          username: mailboxForm.username,
          password: mailboxForm.password,
          legalEntityId: mailboxForm.legalEntityId || null,
          fromFilter: mailboxForm.fromFilter || null,
          active: mailboxForm.active,
        },
      }),
    onSuccess: async () => {
      setMailboxForm({
        ...initialMailboxForm,
        legalEntityId: selectedLegalEntityId,
      });
      setMailboxModalOpen(false);
      setFeedback({ tone: "success", message: "Mailbox created." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });
  const markAllNotificationsMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: boolean; count: number }>("/changelog/mark-all-seen", {
        method: "POST",
      }),
    onSuccess: async () => {
      setFeedback({ tone: "success", message: "All notifications marked as read." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });
  const saveAutomationSettingsMutation = useMutation({
    mutationFn: () =>
      apiRequest<AutomationSettingsResponse>("/settings/automation", {
        method: "PATCH",
        body: {
          emailIngestEnabled: automationSettingsForm.emailIngestEnabled,
          batchProcessingEnabled: automationSettingsForm.batchProcessingEnabled,
          autoSyncMailboxes: automationSettingsForm.autoSyncMailboxes,
          autoTestIntegrations: automationSettingsForm.autoTestIntegrations,
          draftAutoReprocess: automationSettingsForm.draftAutoReprocess,
          notificationDigestEnabled: automationSettingsForm.notificationDigestEnabled,
          defaultEnvironment: automationSettingsForm.defaultEnvironment,
          maxEmailsPerRun: Number(automationSettingsForm.maxEmailsPerRun),
          batchIntervalMinutes: Number(automationSettingsForm.batchIntervalMinutes),
        },
      }),
    onSuccess: async ({ settings }) => {
      setAutomationSettingsForm({
        emailIngestEnabled: settings.emailIngestEnabled,
        batchProcessingEnabled: settings.batchProcessingEnabled,
        autoSyncMailboxes: settings.autoSyncMailboxes,
        autoTestIntegrations: settings.autoTestIntegrations,
        draftAutoReprocess: settings.draftAutoReprocess,
        notificationDigestEnabled: settings.notificationDigestEnabled,
        defaultEnvironment: settings.defaultEnvironment,
        maxEmailsPerRun: String(settings.maxEmailsPerRun),
        batchIntervalMinutes: String(settings.batchIntervalMinutes),
      });
      setFeedback({ tone: "success", message: "Automation settings saved." });
      await refreshSettings();
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    },
  });

  if (
    isLoading ||
    omieQuery.isLoading ||
    asaasQuery.isLoading ||
    legalEntitiesQuery.isLoading ||
    mailboxesQuery.isLoading ||
    notificationsQuery.isLoading ||
    automationSettingsQuery.isLoading
  ) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineState label="Carregando configuracoes..." />
      </div>
    );
  }

  if (
    isError ||
    omieQuery.isError ||
    asaasQuery.isError ||
    legalEntitiesQuery.isError ||
    mailboxesQuery.isError ||
    notificationsQuery.isError ||
    automationSettingsQuery.isError ||
    !data
  ) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineError label="Nao foi possivel carregar as configuracoes." />
      </div>
    );
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8">
      <PageHeader title="Configuracoes" desc="Personalize sua operacao financeira inteligente" />

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
                    active === section.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
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
          {feedback ? (
            <Card
              className={cn(
                "p-4 text-[12.5px]",
                feedback.tone === "success"
                  ? "border-success/20 bg-success/5 text-success"
                  : "border-destructive/20 bg-destructive/5 text-destructive",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span data-testid="settings-feedback">{feedback.message}</span>
                <button
                  onClick={() => setFeedback(null)}
                  className="rounded-md border border-current/20 px-2 py-1 text-[11px]"
                >
                  Fechar
                </button>
              </div>
            </Card>
          ) : null}

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <SettingsIcon className="size-4 text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Secao</span>
            </div>
            <h2 className="text-[20px] font-semibold tracking-tight">
              {data.sections.find((section) => section.id === active)?.label}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              Gerencie todos os parametros desta area.
            </p>
          </Card>

          {active === "integracoes" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Stat label="Legal entities" value={String(legalEntitiesQuery.data?.items.length ?? 0)} accent="info" icon={<Building2 className="size-4" />} />
                <Stat label="Mailboxes" value={String(mailboxCount)} accent="ai" icon={<Mail className="size-4" />} />
                <Stat label="OMIE conexoes" value={String(omieConnectionCount)} accent="success" icon={<Plug className="size-4" />} />
                <Stat label="ASAAS conexoes" value={String(asaasConnectionCount)} accent="warning" icon={<Plug className="size-4" />} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.integrations.map((item) => (
                  <Card key={item.id} className="p-4 flex items-center gap-4">
                    <div className="size-10 rounded-md bg-muted grid place-items-center font-semibold text-[12px]">
                      {item.name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium">{item.name}</div>
                      <div className="text-[12px] text-muted-foreground">{item.desc}</div>
                    </div>
                    {item.status === "connected" ? (
                      <span className="text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success border border-success/20">
                        <span className="size-1.5 rounded-full bg-success" /> Conectado
                      </span>
                    ) : (
                      <button
                        onClick={() => setActive("integracoes")}
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent"
                      >
                        Conectar
                      </button>
                    )}
                  </Card>
                ))}

                <Card className="p-4 md:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13.5px] font-medium">Legal entity</div>
                      <div className="text-[12px] text-muted-foreground">
                        Cada entidade pode ter suas conexoes ERP e inbox dedicados.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setMailboxForm((current) => ({ ...current, legalEntityId: selectedLegalEntityId }));
                        setMailboxModalOpen(true);
                      }}
                      className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent inline-flex items-center gap-1.5"
                    >
                      <Plus className="size-3.5" /> Novo mailbox
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {legalEntitiesQuery.data?.items.map((entity) => (
                      <button
                        key={entity.id}
                        onClick={() => setSelectedLegalEntityId(entity.id)}
                        className={cn(
                          "rounded-md border px-3 py-2 text-[12px]",
                          selectedLegalEntityId === entity.id
                            ? "border-ai/40 bg-ai/10 text-ai"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        {entity.tradeName || entity.legalName}
                      </button>
                    ))}
                  </div>
                  {selectedLegalEntity ? (
                    <div className="mt-3 text-[12px] text-muted-foreground">
                      Route aliases: {selectedLegalEntity.defaultRecipientEmails.join(", ") || "none"}.
                    </div>
                  ) : null}
                </Card>
              </div>

              <Card className="p-5">
                <SectionHeader
                  title="Mailboxes da entidade"
                  desc="Um cliente pode operar varios inboxes. Todos entram na mesma fila revisavel."
                  action={
                    <button
                      onClick={() => {
                        setMailboxForm((current) => ({ ...current, legalEntityId: selectedLegalEntityId }));
                        setMailboxModalOpen(true);
                      }}
                      className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent inline-flex items-center gap-1.5"
                    >
                      <Plus className="size-3.5" /> Adicionar mailbox
                    </button>
                  }
                />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {selectedMailboxes.length ? (
                    selectedMailboxes.map((mailbox) => (
                      <div
                        key={mailbox.id}
                        data-testid={`settings-mailbox-card-${mailbox.id}`}
                        className="rounded-xl border border-border bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[14px] font-semibold">{mailbox.name}</div>
                            <div className="text-[12px] text-muted-foreground">{mailbox.username}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {mailbox.host}:{mailbox.port} · TLS {mailbox.tls ? "on" : "off"}
                            </div>
                          </div>
                          <StatusBadge status={mailbox.active ? "active" : "paused"} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                          <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ultimo sync</div>
                            <div className="mt-1">
                              {mailbox.lastSyncAt ? new Date(mailbox.lastSyncAt).toLocaleString("pt-BR") : "Nunca"}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Filtro</div>
                            <div className="mt-1 truncate">{mailbox.fromFilter || "Todos remetentes"}</div>
                          </div>
                        </div>
                        {mailbox.lastError ? (
                          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                            {mailbox.lastError}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => mailboxActionMutation.mutate({ id: mailbox.id, action: "test" })}
                            disabled={mailboxActionMutation.isPending}
                            className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60 inline-flex items-center gap-1.5"
                          >
                            <TestTube2 className="size-3.5" /> Testar
                          </button>
                          <button
                            onClick={() => mailboxActionMutation.mutate({ id: mailbox.id, action: "sync" })}
                            disabled={mailboxActionMutation.isPending}
                            className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60 inline-flex items-center gap-1.5"
                          >
                            <RefreshCcw className="size-3.5" /> Sincronizar
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-border bg-background/60 p-4 text-[12.5px] text-muted-foreground xl:col-span-2">
                      Nenhum mailbox cadastrado para esta entidade ainda.
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedOmieEnvironments.map((environment) => {
                  const values = draftValues[environment.environment] ?? {
                    appKey: "",
                    appSecret: "",
                    baseUrl: environment.baseUrl,
                    enabled: environment.enabled,
                  };

                  return (
                    <Card key={environment.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[13.5px] font-medium">
                            OMIE {environment.environment === "HOMOLOG" ? "Homologacao" : "Producao"}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            Status {environment.lastHealthcheckStatus.toLowerCase()}, ultimo sync{" "}
                            {environment.lastSyncAt
                              ? new Date(environment.lastSyncAt).toLocaleString("pt-BR")
                              : "nunca"}
                            .
                          </div>
                        </div>
                        <span
                          className={cn(
                            "text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md border",
                            environment.enabled
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          <span className="size-1.5 rounded-full bg-current" />{" "}
                          {environment.enabled ? "Ativa" : "Pausada"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <input
                          value={values.baseUrl}
                          onChange={(event) =>
                            setDraftValues((current) => ({
                              ...current,
                              [environment.environment]: { ...values, baseUrl: event.target.value },
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
                                [environment.environment]: { ...values, enabled: event.target.checked },
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
                              [environment.environment]: { ...values, appKey: event.target.value },
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
                              [environment.environment]: { ...values, appSecret: event.target.value },
                            }))
                          }
                          className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                          placeholder={
                            environment.hasAppSecret ? "App Secret salvo, preencha para trocar" : "App Secret"
                          }
                        />
                      </div>

                      {environment.lastError ? (
                        <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                          {environment.lastError}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            selectedLegalEntityId &&
                            saveMutation.mutate({
                              legalEntityId: selectedLegalEntityId,
                              environment: environment.environment,
                              ...values,
                            })
                          }
                          data-testid={`settings-omie-save-${environment.environment.toLowerCase()}`}
                          disabled={saveMutation.isPending}
                          className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() =>
                            selectedLegalEntityId &&
                            testMutation.mutate({
                              legalEntityId: selectedLegalEntityId,
                              environment: environment.environment,
                            })
                          }
                          disabled={testMutation.isPending}
                          className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                        >
                          Testar conexao
                        </button>
                        <button
                          onClick={() =>
                            selectedLegalEntityId &&
                            syncMutation.mutate({
                              legalEntityId: selectedLegalEntityId,
                              environment: environment.environment,
                            })
                          }
                          disabled={syncMutation.isPending}
                          className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                        >
                          Sincronizar catalogos
                        </button>
                      </div>
                    </Card>
                  );
                })}

                {selectedAsaasEnvironments.map((environment) => {
                  const values = asaasDraftValues[environment.environment] ?? {
                    apiKey: "",
                    webhookAuthToken: "",
                    baseUrl: environment.baseUrl,
                    enabled: environment.enabled,
                  };

                  return (
                    <Card key={environment.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[13.5px] font-medium">
                            ASAAS {environment.environment === "SANDBOX" ? "Sandbox" : "Producao"}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            Status {environment.lastHealthcheckStatus.toLowerCase()}, ultimo sync{" "}
                            {environment.lastSyncAt
                              ? new Date(environment.lastSyncAt).toLocaleString("pt-BR")
                              : "nunca"}
                            .
                          </div>
                        </div>
                        <span
                          className={cn(
                            "text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md border",
                            environment.enabled
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          <span className="size-1.5 rounded-full bg-current" />{" "}
                          {environment.enabled ? "Ativa" : "Pausada"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <input
                          value={values.baseUrl}
                          onChange={(event) =>
                            setAsaasDraftValues((current) => ({
                              ...current,
                              [environment.environment]: { ...values, baseUrl: event.target.value },
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
                                [environment.environment]: { ...values, enabled: event.target.checked },
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
                              [environment.environment]: { ...values, apiKey: event.target.value },
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
                              [environment.environment]: {
                                ...values,
                                webhookAuthToken: event.target.value,
                              },
                            }))
                          }
                          className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                          placeholder={
                            environment.hasWebhookToken
                              ? "Webhook token salvo, preencha para trocar"
                              : "Webhook token"
                          }
                        />
                      </div>

                      {environment.lastError ? (
                        <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                          {environment.lastError}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            selectedLegalEntityId &&
                            saveAsaasMutation.mutate({
                              legalEntityId: selectedLegalEntityId,
                              environment: environment.environment,
                              ...values,
                            })
                          }
                          data-testid={`settings-asaas-save-${environment.environment.toLowerCase()}`}
                          disabled={saveAsaasMutation.isPending}
                          className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() =>
                            selectedLegalEntityId &&
                            testAsaasMutation.mutate({
                              legalEntityId: selectedLegalEntityId,
                              environment: environment.environment,
                            })
                          }
                          disabled={testAsaasMutation.isPending}
                          className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                        >
                          Testar conexao
                        </button>
                        <button
                          onClick={() =>
                            selectedLegalEntityId &&
                            syncAsaasMutation.mutate({
                              legalEntityId: selectedLegalEntityId,
                              environment: environment.environment,
                            })
                          }
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
            </div>
          ) : null}

          {active === "ia" ? (
            <Card className="p-6 space-y-5">
              {data.ai.map((item) => (
                <div
                  key={item.l}
                  className="flex items-start justify-between gap-6 pb-5 border-b border-border last:border-0 last:pb-0"
                >
                  <div>
                    <div className="text-[13.5px] font-medium">{item.l}</div>
                    {item.hint ? <div className="text-[12px] text-muted-foreground mt-0.5">{item.hint}</div> : null}
                  </div>
                  <button className="h-8 px-3 rounded-md border border-border bg-background text-[12.5px] hover:bg-accent shrink-0">
                    {item.v}
                  </button>
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
                <div className="text-[13.5px] font-medium">Dominio</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{data.company.domain}</div>
              </div>
              <div>
                <div className="text-[13.5px] font-medium">Empresas gerenciadas</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{data.company.companiesCount}</div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
                <div className="text-[13.5px] font-medium">Active company settings</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={companyForm.name}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
                    placeholder="Company name"
                  />
                  <input
                    value={companyForm.domain}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, domain: event.target.value }))}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
                    placeholder="Company domain"
                  />
                  <input
                    value={companyForm.replyFromName}
                    onChange={(event) =>
                      setCompanyForm((current) => ({ ...current, replyFromName: event.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
                    placeholder="Reply sender name"
                  />
                  <input
                    value={companyForm.replyFromEmail}
                    onChange={(event) =>
                      setCompanyForm((current) => ({ ...current, replyFromEmail: event.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
                    placeholder="Reply sender email"
                  />
                  <input
                    value={companyForm.replyToEmail}
                    onChange={(event) =>
                      setCompanyForm((current) => ({ ...current, replyToEmail: event.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px] md:col-span-2"
                    placeholder="Reply-to email"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] text-muted-foreground">
                    Reply metadata stays at company scope, legal entities stay below.
                  </div>
                  <button
                    onClick={() => saveCompanyMutation.mutate(companyForm)}
                    disabled={saveCompanyMutation.isPending}
                    className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                  >
                    Save company
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
                <div className="text-[13.5px] font-medium">Legal entities</div>
                <input value={entityForm.legalName} onChange={(event) => setEntityForm((current) => ({ ...current, legalName: event.target.value }))} className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Legal name" />
                <input value={entityForm.tradeName} onChange={(event) => setEntityForm((current) => ({ ...current, tradeName: event.target.value }))} className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Trade name" />
                <input value={entityForm.cnpj} onChange={(event) => setEntityForm((current) => ({ ...current, cnpj: event.target.value }))} className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="CNPJ" />
                <input value={entityForm.defaultRecipientEmails} onChange={(event) => setEntityForm((current) => ({ ...current, defaultRecipientEmails: event.target.value }))} className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Recipient aliases, comma separated" />
                <input value={entityForm.defaultMailboxIds} onChange={(event) => setEntityForm((current) => ({ ...current, defaultMailboxIds: event.target.value }))} className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Mailbox ids, comma separated" />
                <textarea value={entityForm.notes} onChange={(event) => setEntityForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-[90px] w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px]" placeholder="Notes" />
                <label className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px] inline-flex items-center gap-2">
                  <input type="checkbox" checked={entityForm.active} onChange={(event) => setEntityForm((current) => ({ ...current, active: event.target.checked }))} />
                  Active
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      saveLegalEntityMutation.mutate({
                        id: selectedLegalEntity?.id,
                        legalName: entityForm.legalName,
                        tradeName: entityForm.tradeName,
                        cnpj: entityForm.cnpj,
                        active: entityForm.active,
                        defaultRecipientEmails: entityForm.defaultRecipientEmails
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                        defaultMailboxIds: entityForm.defaultMailboxIds
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                        notes: entityForm.notes,
                      })
                    }
                    className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent"
                  >
                    {selectedLegalEntity ? "Update legal entity" : "Create legal entity"}
                  </button>
                  {selectedLegalEntity && !selectedLegalEntity.isDefault ? (
                    <button
                      onClick={() => removeLegalEntityMutation.mutate(selectedLegalEntity.id)}
                      className="text-[12px] px-2.5 py-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5"
                    >
                      Delete legal entity
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {active === "notificacoes" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Stat label="Nao lidas" value={String(unreadNotifications.length)} accent="warning" icon={<Bell className="size-4" />} />
                <Stat label="Publicadas" value={String(notificationsQuery.data?.items.length ?? 0)} accent="info" icon={<Bell className="size-4" />} />
                <Stat label="Mailboxes ativos" value={String(mailboxesQuery.data?.items.filter((item) => item.active).length ?? 0)} accent="ai" icon={<Mail className="size-4" />} />
                <Stat label="Canais email" value={String(mailboxesQuery.data?.items.length > 0 ? 1 : 0)} accent="success" icon={<Mail className="size-4" />} />
              </div>

              <Card className="p-5">
                <SectionHeader
                  title="Centro de notificacoes"
                  desc="Novidades publicadas, alertas do produto e leitura consolidada para o cliente."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="/novidades"
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent"
                      >
                        Abrir timeline
                      </a>
                      <button
                        onClick={() => markAllNotificationsMutation.mutate()}
                        disabled={markAllNotificationsMutation.isPending || unreadNotifications.length === 0}
                        data-testid="settings-notifications-mark-all"
                        className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                      >
                        Marcar tudo como lido
                      </button>
                    </div>
                  }
                />

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 space-y-3">
                    {notificationsQuery.data?.items.length ? (
                      notificationsQuery.data.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-border bg-background/60 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="text-[14px] font-semibold">{item.title}</div>
                                {item.unread ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/20">
                                    Novo
                                  </span>
                                ) : (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
                                    Lido
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-[12px] text-muted-foreground">
                                v{item.version} · {item.author.name}
                              </div>
                            </div>
                            <StatusBadge status={item.unread ? "Pendente" : "Processado"} />
                          </div>
                          <p className="mt-3 text-[12.5px] text-foreground/90">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-border bg-background/60 p-4 text-[12.5px] text-muted-foreground">
                        Nenhuma notificacao publicada ainda.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="text-[13px] font-medium">Canais ativos</div>
                      <div className="mt-3 space-y-2 text-[12px]">
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                          <div className="font-medium">In-app</div>
                          <div className="text-muted-foreground">Bell, sidebar badge e tela de novidades.</div>
                        </div>
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                          <div className="font-medium">Email ingest</div>
                          <div className="text-muted-foreground">
                            {mailboxesQuery.data?.items.length
                              ? `${mailboxesQuery.data.items.length} mailbox(es) monitorados.`
                              : "Nenhum mailbox configurado."}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="text-[13px] font-medium">Preferencias atuais</div>
                      <div className="mt-3 space-y-2 text-[12px]">
                        <label className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                          <span>Badge no menu</span>
                          <input type="checkbox" checked readOnly />
                        </label>
                        <label className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                          <span>Badge no topo</span>
                          <input type="checkbox" checked readOnly />
                        </label>
                        <label className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                          <span>Resumo por email</span>
                          <input type="checkbox" checked={mailboxesQuery.data?.items.length > 0} readOnly />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {active === "automacao" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Stat label="Ingestao email" value={automationSettingsForm.emailIngestEnabled ? "On" : "Off"} accent="ai" icon={<Mail className="size-4" />} />
                <Stat label="Modo lote" value={automationSettingsForm.batchProcessingEnabled ? "Lote" : "1 a 1"} accent="info" icon={<Zap className="size-4" />} />
                <Stat label="Limite por ciclo" value={automationSettingsForm.maxEmailsPerRun} accent="warning" icon={<RefreshCcw className="size-4" />} />
                <Stat label="Intervalo" value={`${automationSettingsForm.batchIntervalMinutes} min`} accent="success" icon={<SettingsIcon className="size-4" />} />
              </div>

              <Card className="p-5">
                <SectionHeader
                  title="Runtime da automacao"
                  desc="Controles locais para ingestao, lote e comportamento automatico. Nenhuma acao externa e disparada daqui."
                />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-[12.5px]">
                      <div>
                        <div className="font-medium">Processar emails automaticamente</div>
                        <div className="text-muted-foreground">Worker ignora mailboxes quando esta chave estiver desligada.</div>
                      </div>
                      <input
                        type="checkbox"
                        data-testid="settings-automation-email-ingest"
                        checked={automationSettingsForm.emailIngestEnabled}
                        onChange={(event) =>
                          setAutomationSettingsForm((current) => ({
                            ...current,
                            emailIngestEnabled: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-[12.5px]">
                      <div>
                        <div className="font-medium">Executar em lote</div>
                        <div className="text-muted-foreground">Automatico usa lote, desligado cai para 1 email por ciclo.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={automationSettingsForm.batchProcessingEnabled}
                        onChange={(event) =>
                          setAutomationSettingsForm((current) => ({
                            ...current,
                            batchProcessingEnabled: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-[12.5px]">
                      <div>
                        <div className="font-medium">Sincronizar mailboxes automaticamente</div>
                        <div className="text-muted-foreground">Manual continua disponivel mesmo com esta chave desligada.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={automationSettingsForm.autoSyncMailboxes}
                        onChange={(event) =>
                          setAutomationSettingsForm((current) => ({
                            ...current,
                            autoSyncMailboxes: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-[12.5px]">
                      <div>
                        <div className="font-medium">Reprocesso automatico de draft</div>
                        <div className="text-muted-foreground">Apenas preferencia local por enquanto, sem execucao externa.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={automationSettingsForm.draftAutoReprocess}
                        onChange={(event) =>
                          setAutomationSettingsForm((current) => ({
                            ...current,
                            draftAutoReprocess: event.target.checked,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-[12.5px]">
                      <div>
                        <div className="font-medium">Teste automatico de integracoes</div>
                        <div className="text-muted-foreground">Preferencia salva, mas nenhuma chamada externa roda sem clique manual.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={automationSettingsForm.autoTestIntegrations}
                        onChange={(event) =>
                          setAutomationSettingsForm((current) => ({
                            ...current,
                            autoTestIntegrations: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-[12.5px]">
                      <div>
                        <div className="font-medium">Resumo de notificacoes</div>
                        <div className="text-muted-foreground">Canal local para futuros digests, sem envio externo neste step.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={automationSettingsForm.notificationDigestEnabled}
                        onChange={(event) =>
                          setAutomationSettingsForm((current) => ({
                            ...current,
                            notificationDigestEnabled: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
                      <div className="font-medium text-[13px]">Politica de execucao</div>
                      <select
                        value={automationSettingsForm.defaultEnvironment}
                        onChange={(event) =>
                          setAutomationSettingsForm((current) => ({
                            ...current,
                            defaultEnvironment: event.target.value as "HOMOLOG" | "SANDBOX",
                          }))
                        }
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
                      >
                        <option value="HOMOLOG">Homolog</option>
                        <option value="SANDBOX">Sandbox</option>
                      </select>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={automationSettingsForm.maxEmailsPerRun}
                          onChange={(event) =>
                            setAutomationSettingsForm((current) => ({
                              ...current,
                              maxEmailsPerRun: event.target.value,
                            }))
                          }
                          data-testid="settings-automation-max-emails"
                          className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                          placeholder="Max emails"
                        />
                        <input
                          value={automationSettingsForm.batchIntervalMinutes}
                          onChange={(event) =>
                            setAutomationSettingsForm((current) => ({
                              ...current,
                              batchIntervalMinutes: event.target.value,
                            }))
                          }
                          className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                          placeholder="Intervalo min"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[12px] text-muted-foreground">
                    Manual sync, teste de mailbox e integracoes continuam disponiveis mesmo quando automacao automatica estiver desligada.
                  </div>
                  <button
                    onClick={() => saveAutomationSettingsMutation.mutate()}
                    disabled={saveAutomationSettingsMutation.isPending}
                    data-testid="settings-automation-save"
                    className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-60"
                  >
                    Salvar automacao
                  </button>
                </div>
              </Card>
            </div>
          ) : null}

          {active !== "integracoes" && active !== "ia" && active !== "empresa" && active !== "notificacoes" && active !== "automacao" ? (
            <Card className="p-12 text-center">
              <div className="size-12 rounded-full bg-muted grid place-items-center mx-auto mb-4">
                <SettingsIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="text-[14px] font-medium">Em breve</div>
              <div className="text-[12.5px] text-muted-foreground mt-1">
                Esta secao esta sendo construida.
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {mailboxModalOpen ? (
        <div className="fixed inset-0 z-50 bg-background/75 backdrop-blur-sm px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <Card className="p-6">
              <SectionHeader
                title="Novo mailbox"
                desc="Cadastre um inbox operacional para esta entidade."
                action={
                  <button
                    onClick={() => setMailboxModalOpen(false)}
                    className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent"
                  >
                    Fechar
                  </button>
                }
              />
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  createMailboxMutation.mutate();
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={mailboxForm.name}
                    onChange={(event) => setMailboxForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome inbox"
                    data-testid="settings-mailbox-name"
                    className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                  />
                  <select
                    value={mailboxForm.legalEntityId}
                    onChange={(event) =>
                      setMailboxForm((current) => ({ ...current, legalEntityId: event.target.value }))
                    }
                    className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                  >
                    <option value="">Sem entidade</option>
                    {legalEntitiesQuery.data?.items.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.tradeName || entity.legalName}
                      </option>
                    ))}
                  </select>
                  <input
                    value={mailboxForm.username}
                    onChange={(event) =>
                      setMailboxForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder="Usuario IMAP"
                    className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                  />
                  <input
                    value={mailboxForm.password}
                    type="password"
                    onChange={(event) =>
                      setMailboxForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="App password"
                    className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                  />
                  <input
                    value={mailboxForm.host}
                    onChange={(event) => setMailboxForm((current) => ({ ...current, host: event.target.value }))}
                    placeholder="Host"
                    className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                  />
                  <input
                    value={mailboxForm.port}
                    onChange={(event) => setMailboxForm((current) => ({ ...current, port: event.target.value }))}
                    placeholder="Porta"
                    className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                  />
                </div>
                <input
                  value={mailboxForm.fromFilter}
                  onChange={(event) =>
                    setMailboxForm((current) => ({ ...current, fromFilter: event.target.value }))
                  }
                  placeholder="Filtro remetente opcional"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
                />
                <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-background px-3 py-2 text-[12px]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      checked={mailboxForm.tls}
                      onChange={(event) =>
                        setMailboxForm((current) => ({ ...current, tls: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    TLS ativo
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      checked={mailboxForm.active}
                      onChange={(event) =>
                        setMailboxForm((current) => ({ ...current, active: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    Inbox ativa
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMailboxModalOpen(false)}
                    className="text-[12px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createMailboxMutation.isPending}
                    data-testid="settings-mailbox-submit"
                    className="text-[12px] px-2.5 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" /> Cadastrar mailbox
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
