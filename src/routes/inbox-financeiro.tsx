import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  Download,
  Mail,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  TestTube2,
} from "lucide-react";
import {
  Card,
  ConfidenceBar,
  PageHeader,
  SectionHeader,
  Stat,
  StatusBadge,
} from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { useAuth } from "@/hooks/use-auth";
import { apiDownload, apiRequest } from "@/lib/api";
import type {
  AutomationSummaryResponse,
  InboxEmailDetailResponse,
  InboxListResponse,
  MailboxesResponse,
} from "@/lib/api-types";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type MailboxFormState = {
  name: string;
  host: string;
  port: string;
  tls: boolean;
  username: string;
  password: string;
  fromFilter: string;
  active: boolean;
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
};

export const Route = createFileRoute("/inbox-financeiro")({
  head: () => ({ meta: [{ title: "Inbox Financeiro · Veridia" }] }),
  component: InboxFinanceiroPage,
});

function buildInboxPath(status?: string, confidenceBand?: string) {
  const params = new URLSearchParams({ limit: "50" });
  if (status && status !== "ALL") {
    params.set("status", status);
  }
  if (confidenceBand && confidenceBand !== "ALL") {
    params.set("confidenceBand", confidenceBand);
  }
  return `/inbox/emails?${params.toString()}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Nunca";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function sizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function statusPill(status: string) {
  if (status === "SUCESSO") {
    return "Processado";
  }
  if (status === "ERRO") {
    return "Excecao";
  }
  if (status === "AGUARDANDO_VALIDACAO") {
    return "Em revisao";
  }
  if (status === "PENDENTE_REVISAO") {
    return "Em revisao";
  }
  if (status === "RECEBIDO" || status === "PROCESSANDO") {
    return "Pendente";
  }
  if (status === "ALTA") {
    return "Alta";
  }
  if (status === "MEDIA") {
    return "Media";
  }
  if (status === "BAIXA") {
    return "Baixa";
  }
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function InboxFinanceiroPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState("ALL");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [mailboxForm, setMailboxForm] = useState<MailboxFormState>(initialMailboxForm);

  const mailboxesQuery = useQuery({
    queryKey: ["mailboxes"],
    queryFn: () => apiRequest<MailboxesResponse>("/mailboxes"),
    staleTime: 30_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["automation-summary"],
    queryFn: () => apiRequest<AutomationSummaryResponse>("/automation/summary"),
    refetchInterval: 20_000,
  });

  const inboxQuery = useQuery({
    queryKey: ["inbox-emails", statusFilter, confidenceFilter],
    queryFn: () => apiRequest<InboxListResponse>(buildInboxPath(statusFilter, confidenceFilter)),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!selectedEmailId && inboxQuery.data?.items[0]?.id) {
      setSelectedEmailId(inboxQuery.data.items[0].id);
    }
  }, [inboxQuery.data, selectedEmailId]);

  useEffect(() => {
    if (
      selectedEmailId &&
      inboxQuery.data &&
      !inboxQuery.data.items.some((item) => item.id === selectedEmailId)
    ) {
      setSelectedEmailId(inboxQuery.data.items[0]?.id ?? null);
    }
  }, [inboxQuery.data, selectedEmailId]);

  const detailQuery = useQuery({
    queryKey: ["inbox-email-detail", selectedEmailId],
    queryFn: () => apiRequest<InboxEmailDetailResponse>(`/inbox/emails/${selectedEmailId}`),
    enabled: Boolean(selectedEmailId),
  });

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] }),
      queryClient.invalidateQueries({ queryKey: ["automation-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-emails"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-email-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    ]);
  };

  const mailboxActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "test" | "sync" }) =>
      apiRequest(`/mailboxes/${id}/${action}`, {
        method: "POST",
      }),
    onSuccess: refreshQueries,
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
          fromFilter: mailboxForm.fromFilter || null,
          active: mailboxForm.active,
        },
      }),
    onSuccess: async () => {
      setMailboxForm(initialMailboxForm);
      await refreshQueries();
    },
  });

  const selectedSummaryItem = useMemo(
    () =>
      inboxQuery.data?.items.find((item) => item.id === selectedEmailId) ??
      inboxQuery.data?.items[0] ??
      null,
    [inboxQuery.data, selectedEmailId],
  );

  const downloadAttachment = async (
    attachment: InboxEmailDetailResponse["attachments"][number],
  ) => {
    const payload = await apiDownload(attachment.downloadPath.replace(/^\/api/, ""));
    const url = window.URL.createObjectURL(payload.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.originalName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  if (mailboxesQuery.isLoading || summaryQuery.isLoading || inboxQuery.isLoading) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineState label="Carregando inbox financeiro..." />
      </div>
    );
  }

  if (
    mailboxesQuery.isError ||
    summaryQuery.isError ||
    inboxQuery.isError ||
    !mailboxesQuery.data ||
    !summaryQuery.data ||
    !inboxQuery.data
  ) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineError label="Nao foi possivel carregar inbox financeiro." />
      </div>
    );
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Inbox Financeiro"
        desc="Inbox operacional e o ponto primario de entrada. Emails viram pre-entradas para revisao humana."
        actions={
          <button
            onClick={() => void refreshQueries()}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-[12.5px] hover:bg-accent"
          >
            <RefreshCcw className="size-3.5" /> Atualizar
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Emails processados"
          value={String(summaryQuery.data.stats.processed)}
          accent="ai"
          icon={<Mail className="size-4" />}
        />
        <Stat
          label="Pendentes revisao"
          value={String(summaryQuery.data.stats.pendingReview)}
          accent="warning"
          icon={<ShieldAlert className="size-4" />}
        />
        <Stat
          label="Baixa confianca"
          value={String(summaryQuery.data.stats.lowConfidence)}
          accent="info"
          icon={<Sparkles className="size-4" />}
        />
        <Stat
          label="Volume identificado"
          value={formatCurrency(summaryQuery.data.stats.volume)}
          accent="success"
          icon={<Bot className="size-4" />}
        />
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-5">
          <SectionHeader
            title="Mailboxes monitorados"
            desc="Estado atual de ingestao e sync por inbox."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {mailboxesQuery.data.items.map((mailbox) => (
              <div
                key={mailbox.id}
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
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                      Ultimo sync
                    </div>
                    <div className="mt-1">{formatDateTime(mailbox.lastSyncAt)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                      Filtro
                    </div>
                    <div className="mt-1 truncate">{mailbox.fromFilter || "Todos remetentes"}</div>
                  </div>
                </div>
                {mailbox.lastError ? (
                  <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                    {mailbox.lastError}
                  </div>
                ) : null}
                {user?.role === "ADMIN" ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() =>
                        mailboxActionMutation.mutate({ id: mailbox.id, action: "test" })
                      }
                      className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border text-[12px] hover:bg-accent"
                    >
                      <TestTube2 className="size-3.5" /> Testar
                    </button>
                    <button
                      onClick={() =>
                        mailboxActionMutation.mutate({ id: mailbox.id, action: "sync" })
                      }
                      className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12px] font-medium hover:opacity-90"
                    >
                      <RefreshCcw className="size-3.5" /> Sincronizar
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            title="Novo mailbox"
            desc="Admin cadastra o inbox operacional. Processamento fica sempre dentro da fila revisavel."
          />
          {user?.role !== "ADMIN" ? (
            <div className="rounded-lg border border-border bg-background/60 px-3 py-3 text-[12.5px] text-muted-foreground">
              Somente ADMIN pode cadastrar mailbox.
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                createMailboxMutation.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={mailboxForm.name}
                  onChange={(event) =>
                    setMailboxForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Nome inbox"
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                />
                <input
                  value={mailboxForm.username}
                  onChange={(event) =>
                    setMailboxForm((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="Usuario IMAP"
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                />
              </div>
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <input
                  value={mailboxForm.host}
                  onChange={(event) =>
                    setMailboxForm((current) => ({ ...current, host: event.target.value }))
                  }
                  placeholder="Host"
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                />
                <input
                  value={mailboxForm.port}
                  onChange={(event) =>
                    setMailboxForm((current) => ({ ...current, port: event.target.value }))
                  }
                  placeholder="Porta"
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                />
              </div>
              <input
                value={mailboxForm.password}
                type="password"
                onChange={(event) =>
                  setMailboxForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="App password"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
              />
              <input
                value={mailboxForm.fromFilter}
                onChange={(event) =>
                  setMailboxForm((current) => ({ ...current, fromFilter: event.target.value }))
                }
                placeholder="Filtro remetente opcional"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
              />
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-[12px]">
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
              <button
                type="submit"
                disabled={createMailboxMutation.isPending}
                className="h-9 w-full rounded-md bg-foreground text-background text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Plus className="size-3.5" /> Cadastrar mailbox
              </button>
            </form>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-7 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
            {[
              ["ALL", "Todos"],
              ["RECEBIDO", "Recebidos"],
              ["AGUARDANDO_VALIDACAO", "Revisao"],
              ["APROVADO", "Aprovados"],
              ["ERRO", "Erro"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "h-8 px-2.5 rounded-md border text-[12px]",
                  statusFilter === value
                    ? "border-ai/40 bg-ai/10 text-ai"
                    : "border-border hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {[
                ["ALL", "Confianca"],
                ["ALTA", "Alta"],
                ["MEDIA", "Media"],
                ["BAIXA", "Baixa"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setConfidenceFilter(value)}
                  className={cn(
                    "h-8 px-2.5 rounded-md border text-[12px]",
                    confidenceFilter === value
                      ? "border-info/40 bg-info/10 text-info"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Origem</th>
                <th className="text-left px-4 py-2 font-medium">Assunto</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Draft</th>
                <th className="text-left px-4 py-2 font-medium">Recebido</th>
              </tr>
            </thead>
            <tbody>
              {inboxQuery.data.items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedEmailId(item.id)}
                  className={cn(
                    "border-b border-border last:border-0 cursor-pointer hover:bg-accent/40",
                    selectedSummaryItem?.id === item.id && "bg-ai/5",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.sender}</div>
                    <div className="text-[11px] text-muted-foreground">{item.mailbox}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.subject}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.attachmentCount} anexo(s)
                    </div>
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    <StatusBadge status={statusPill(item.status)} />
                    {item.extractionStatus ? (
                      <StatusBadge status={statusPill(item.extractionStatus)} />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {item.draft ? (
                      <div className="space-y-1">
                        <div className="font-medium">{item.draft.partyName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.draft.amount ? formatCurrency(item.draft.amount) : "Sem valor"} ·{" "}
                          {statusPill(item.draft.confidenceBand)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sem draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(item.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="xl:col-span-5 p-5">
          {detailQuery.isLoading ? (
            <InlineState label="Carregando detalhe do email..." />
          ) : detailQuery.isError || !detailQuery.data ? (
            <InlineError label="Nao foi possivel carregar detalhe do email." />
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Email selecionado
                  </div>
                  <h2 className="text-[18px] font-semibold tracking-tight mt-1">
                    {detailQuery.data.subject}
                  </h2>
                  <div className="mt-2 text-[12px] text-muted-foreground">
                    {detailQuery.data.sender} · {formatDateTime(detailQuery.data.receivedAt)}
                  </div>
                </div>
                <StatusBadge status={statusPill(detailQuery.data.status)} />
              </div>

              {detailQuery.data.processingError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                  {detailQuery.data.processingError}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-background/60 p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  Corpo do email
                </div>
                <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-6 text-foreground/90">
                  {detailQuery.data.bodyText}
                </pre>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Download className="size-3.5" /> Anexos
                </div>
                <div className="space-y-2">
                  {detailQuery.data.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="rounded-lg border border-border bg-background/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-[12.5px]">{attachment.originalName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {attachment.mimeType} · {sizeLabel(attachment.sizeBytes)}
                          </div>
                        </div>
                        <button
                          onClick={() => void downloadAttachment(attachment)}
                          className="h-8 px-2.5 rounded-md border border-border text-[12px] hover:bg-accent"
                        >
                          Baixar
                        </button>
                      </div>
                      {attachment.extractedText ? (
                        <div className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
                          {attachment.extractedText}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Execucoes n8n
                  </div>
                  <div className="space-y-2">
                    {detailQuery.data.extractionRuns.map((run) => (
                      <div
                        key={run.id}
                        className="rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-medium">
                            {run.workflowId || run.provider}
                          </div>
                          <StatusBadge status={statusPill(run.status)} />
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {run.durationMs ? `${run.durationMs} ms` : "sem duracao"} ·{" "}
                          {formatDateTime(run.completedAt || run.startedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Drafts gerados
                  </div>
                  <div className="space-y-3">
                    {detailQuery.data.drafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-lg border border-border bg-card px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-[12.5px]">{draft.partyName}</div>
                          <StatusBadge status={statusPill(draft.status)} />
                        </div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {draft.amount ? formatCurrency(draft.amount) : "Sem valor"} ·{" "}
                          {draft.paymentMethod || "Sem metodo"}
                        </div>
                        <div className="mt-2">
                          <ConfidenceBar value={draft.confidenceScore} />
                        </div>
                        {draft.rejectionReason ? (
                          <div className="mt-2 text-[12px] text-destructive">
                            {draft.rejectionReason}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>

      <Card className="p-5">
        <SectionHeader
          title="Pipeline recente"
          desc="Ultimas execucoes worker e fila de processamento."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {summaryQuery.data.latestRuns.map((run) => (
            <div key={run.id} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <Activity className="size-4 text-ai" />
                  <span className="font-medium">{run.runType}</span>
                </div>
                <StatusBadge status={statusPill(run.status)} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Fetched
                  </div>
                  <div className="mt-1 font-semibold">{run.fetchedCount}</div>
                </div>
                <div className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    OK
                  </div>
                  <div className="mt-1 font-semibold">{run.processedCount}</div>
                </div>
                <div className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Erro
                  </div>
                  <div className="mt-1 font-semibold">{run.errorCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
