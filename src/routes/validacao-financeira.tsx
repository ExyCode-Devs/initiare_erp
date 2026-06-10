import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileText, Save, ShieldAlert, Upload, XCircle } from "lucide-react";
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
import { apiRequest } from "@/lib/api";
import type { FinancialDraftDetailResponse, FinancialDraftListResponse, LegalEntitiesResponse } from "@/lib/api-types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type DraftFormState = {
  partyName: string;
  cpfCnpj: string;
  amount: string;
  dueDate: string;
  competence: string;
  description: string;
  suggestedCategory: string;
  finalCategory: string;
  paymentMethod: string;
  notes: string;
  legalEntityId: string;
};

const emptyDraftForm: DraftFormState = {
  partyName: "",
  cpfCnpj: "",
  amount: "",
  dueDate: "",
  competence: "",
  description: "",
  suggestedCategory: "",
  finalCategory: "",
  paymentMethod: "",
  notes: "",
  legalEntityId: "",
};

export const Route = createFileRoute("/validacao-financeira")({
  head: () => ({ meta: [{ title: "Validacao Financeira · Veridia" }] }),
  component: ValidacaoFinanceiraPage,
});

function formatDateTime(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function humanStatus(status: string) {
  if (status === "PENDENTE_REVISAO") return "Em revisao";
  if (status === "APROVADO") return "Processado";
  if (status === "REJEITADO") return "Excecao";
  if (status === "ALTA") return "Alta";
  if (status === "MEDIA") return "Media";
  if (status === "BAIXA") return "Baixa";
  if (status === "RECEIVED" || status === "PENDENTE") return "Pendente";
  if (status === "PROCESSED" || status === "SUCESSO") return "Processado";
  if (status === "SUCCESS") return "Processado";
  if (status === "ERROR") return "Excecao";
  if (status === "BLOCKED") return "Em revisao";
  if (status === "FAILED" || status === "ERRO") return "Excecao";
  return status;
}

function getSourceTitle(detail: FinancialDraftDetailResponse) {
  return detail.source?.subject ?? detail.sourceEmail?.subject ?? detail.source?.channel ?? "AI event";
}

function getSourceActor(detail: FinancialDraftDetailResponse) {
  return detail.source?.sender ?? detail.sourceEmail?.sender ?? detail.source?.channel ?? "AI event";
}

function getSourceBody(detail: FinancialDraftDetailResponse) {
  return detail.source?.summary ?? detail.sourceEmail?.bodyText ?? "No source summary available.";
}

function normalizeAttachments(detail: FinancialDraftDetailResponse) {
  if (detail.sourceEmail?.attachments?.length) {
    return detail.sourceEmail.attachments.map((attachment) => ({
      id: attachment.id,
      title: attachment.originalName,
      subtitle: attachment.mimeType,
      body: attachment.extractedText,
    }));
  }

  if (Array.isArray(detail.source?.attachments)) {
    return detail.source.attachments.map((attachment, index) => ({
      id: `attachment-${index}`,
      title: `Attachment ${index + 1}`,
      subtitle: "metadata",
      body: JSON.stringify(attachment, null, 2),
    }));
  }

  return [];
}

function normalizeRuns(detail: FinancialDraftDetailResponse) {
  if (detail.aiRun) {
    return [
      {
        id: detail.aiRun.id,
        title: detail.aiRun.provider,
        status: detail.aiRun.status,
        errorMessage: detail.aiRun.errorMessage,
        payload: detail.aiRun.parsedResponse,
      },
    ];
  }

  return (
    detail.sourceEmail?.extractionRuns.map((run) => ({
      id: run.id,
      title: run.workflowId || run.provider,
      status: run.status,
      errorMessage: run.errorMessage,
      payload: run.parsedResponse,
    })) ?? []
  );
}

function ValidacaoFinanceiraPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [omieEnvironment, setOmieEnvironment] = useState<"HOMOLOG" | "PRODUCTION">("HOMOLOG");
  const [formState, setFormState] = useState<DraftFormState>(emptyDraftForm);

  const listPath = useMemo(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (directionFilter !== "ALL") params.set("direction", directionFilter);
    return `/financial-drafts?${params.toString()}`;
  }, [directionFilter, statusFilter]);

  const listQuery = useQuery({
    queryKey: ["financial-drafts", statusFilter, directionFilter],
    queryFn: () => apiRequest<FinancialDraftListResponse>(listPath),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!selectedDraftId && listQuery.data?.items[0]?.id) {
      setSelectedDraftId(listQuery.data.items[0].id);
    }
  }, [listQuery.data, selectedDraftId]);

  useEffect(() => {
    if (
      selectedDraftId &&
      listQuery.data &&
      !listQuery.data.items.some((item) => item.id === selectedDraftId)
    ) {
      setSelectedDraftId(listQuery.data.items[0]?.id ?? null);
    }
  }, [listQuery.data, selectedDraftId]);

  const detailQuery = useQuery({
    queryKey: ["financial-draft-detail", selectedDraftId],
    queryFn: () => apiRequest<FinancialDraftDetailResponse>(`/financial-drafts/${selectedDraftId}`),
    enabled: Boolean(selectedDraftId),
  });
  const legalEntitiesQuery = useQuery({
    queryKey: ["legal-entities"],
    queryFn: () => apiRequest<LegalEntitiesResponse>("/settings/legal-entities"),
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setFormState({
      partyName: detailQuery.data.partyName,
      cpfCnpj: detailQuery.data.cpfCnpj ?? "",
      amount: detailQuery.data.amount == null ? "" : String(detailQuery.data.amount),
      dueDate: detailQuery.data.dueDate ? detailQuery.data.dueDate.slice(0, 10) : "",
      competence: detailQuery.data.competence ?? "",
      description: detailQuery.data.description,
      suggestedCategory: detailQuery.data.suggestedCategory ?? "",
      finalCategory: detailQuery.data.finalCategory ?? "",
      paymentMethod: detailQuery.data.paymentMethod ?? "",
      notes: detailQuery.data.notes ?? "",
      legalEntityId: detailQuery.data.legalEntityId ?? "",
    });
    setRejectReason(detailQuery.data.rejectionReason ?? "");
  }, [detailQuery.data]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["financial-drafts"] }),
      queryClient.invalidateQueries({ queryKey: ["financial-draft-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["automation-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] }),
      queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] }),
      queryClient.invalidateQueries({ queryKey: ["exceptions"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/financial-drafts/${selectedDraftId}`, {
        method: "PATCH",
        body: {
          partyName: formState.partyName,
          cpfCnpj: formState.cpfCnpj || null,
          amount: formState.amount ? Number(formState.amount) : null,
          dueDate: formState.dueDate || null,
          competence: formState.competence || null,
          description: formState.description,
          suggestedCategory: formState.suggestedCategory || null,
          finalCategory: formState.finalCategory || null,
          paymentMethod: formState.paymentMethod || null,
          notes: formState.notes || null,
          legalEntityId: formState.legalEntityId || null,
        },
      }),
    onSuccess: refreshAll,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/financial-drafts/${selectedDraftId}/approve`, {
        method: "POST",
        body: {
          note: formState.notes || null,
        },
      }),
    onSuccess: refreshAll,
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/financial-drafts/${selectedDraftId}/reject`, {
        method: "POST",
        body: {
          reason: rejectReason,
        },
      }),
    onSuccess: refreshAll,
  });

  const exportOmieMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/financial-drafts/${selectedDraftId}/omie-export`, {
        method: "POST",
        body: {
          environment: omieEnvironment,
        },
      }),
    onSuccess: refreshAll,
  });

  const canReview = user?.role === "ADMIN" || user?.role === "ANALYST";
  const totals = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    return {
      pending: items.filter((item) => item.status === "PENDENTE_REVISAO").length,
      approved: items.filter((item) => item.status === "APROVADO").length,
      rejected: items.filter((item) => item.status === "REJEITADO").length,
      volume: items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    };
  }, [listQuery.data]);

  if (listQuery.isLoading) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineState label="Carregando fila de validacao..." />
      </div>
    );
  }

  if (listQuery.isError || !listQuery.data) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineError label="Nao foi possivel carregar drafts financeiros." />
      </div>
    );
  }

  const detail = detailQuery.data;
  const attachments = detail ? normalizeAttachments(detail) : [];
  const runs = detail ? normalizeRuns(detail) : [];
  const latestOmieSync = detail?.omieHistory.syncs[0] ?? null;

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Validacao Financeira"
        desc="Fila humana para editar, aprovar ou rejeitar drafts vindos de AI events."
      />

      {!canReview ? (
        <div className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-[12.5px] text-warning">
          Perfil VIEWER tem acesso somente leitura.
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pendentes" value={String(totals.pending)} accent="warning" icon={<ShieldAlert className="size-4" />} />
        <Stat label="Aprovados" value={String(totals.approved)} accent="success" icon={<CheckCircle2 className="size-4" />} />
        <Stat label="Rejeitados" value={String(totals.rejected)} accent="info" icon={<XCircle className="size-4" />} />
        <Stat label="Volume fila" value={formatCurrency(totals.volume)} accent="ai" icon={<FileText className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-5 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
            {[
              ["ALL", "Todos"],
              ["PENDENTE_REVISAO", "Revisao"],
              ["APROVADO", "Aprovados"],
              ["REJEITADO", "Rejeitados"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "h-8 px-2.5 rounded-md border text-[12px]",
                  statusFilter === value ? "border-ai/40 bg-ai/10 text-ai" : "border-border hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              {[
                ["ALL", "Todos"],
                ["CONTA_PAGAR", "Pagar"],
                ["CONTA_RECEBER", "Receber"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setDirectionFilter(value)}
                  className={cn(
                    "h-8 px-2.5 rounded-md border text-[12px]",
                    directionFilter === value ? "border-info/40 bg-info/10 text-info" : "border-border hover:bg-accent",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {listQuery.data.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedDraftId(item.id)}
                data-testid={`draft-list-item-${item.id}`}
                className={cn("w-full text-left px-4 py-4 hover:bg-accent/40", selectedDraftId === item.id && "bg-ai/5")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">{item.partyName}</div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      {item.source?.subject ?? item.email?.subject ?? item.source?.channel ?? "AI event"}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{item.amount ? formatCurrency(item.amount) : "Sem valor"}</span>
                      <span>·</span>
                      <span>{item.dueDate ? item.dueDate.slice(0, 10) : "Sem vencimento"}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <StatusBadge status={humanStatus(item.status)} />
                    <StatusBadge status={humanStatus(item.confidenceBand)} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-7 p-5">
          {detailQuery.isLoading ? (
            <InlineState label="Carregando detalhe do draft..." />
          ) : detailQuery.isError || !detail ? (
            <InlineError label="Nao foi possivel carregar detalhe do draft." />
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Draft selecionado</div>
                  <h2 className="text-[20px] font-semibold tracking-tight mt-1">{detail.partyName}</h2>
                  <div className="mt-2 text-[12px] text-muted-foreground">
                    {getSourceActor(detail)} · {formatDateTime(detail.source?.receivedAt ?? detail.sourceEmail?.receivedAt ?? null)}
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <StatusBadge status={humanStatus(detail.status)} />
                  <StatusBadge status={humanStatus(detail.confidenceBand)} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/60 p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Confianca calculada</div>
                <ConfidenceBar value={detail.confidenceScore} />
                {Array.isArray(detail.evidence) && detail.evidence.length ? (
                  <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
                    {detail.evidence.map((evidence, index) => (
                      <li key={`${String(evidence)}-${index}`}>• {String(evidence)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <SectionHeader title="Campos extraidos" desc="App valida e decide. Active Actions envia evento normalizado." />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={formState.partyName} onChange={(event) => setFormState((current) => ({ ...current, partyName: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Parte" disabled={!canReview} />
                    <input value={formState.cpfCnpj} onChange={(event) => setFormState((current) => ({ ...current, cpfCnpj: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="CPF/CNPJ" disabled={!canReview} />
                    <input value={formState.amount} onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Valor" disabled={!canReview} />
                    <input value={formState.dueDate} onChange={(event) => setFormState((current) => ({ ...current, dueDate: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" type="date" disabled={!canReview} />
                    <input value={formState.competence} onChange={(event) => setFormState((current) => ({ ...current, competence: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Competencia" disabled={!canReview} />
                    <input value={formState.paymentMethod} onChange={(event) => setFormState((current) => ({ ...current, paymentMethod: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Metodo" disabled={!canReview} />
                    <input value={formState.suggestedCategory} onChange={(event) => setFormState((current) => ({ ...current, suggestedCategory: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Categoria sugerida" disabled={!canReview} />
                    <input value={formState.finalCategory} onChange={(event) => setFormState((current) => ({ ...current, finalCategory: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]" placeholder="Categoria final" disabled={!canReview} />
                    <select value={formState.legalEntityId} onChange={(event) => setFormState((current) => ({ ...current, legalEntityId: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px] col-span-2" disabled={!canReview}>
                      <option value="">Sem roteamento</option>
                      {legalEntitiesQuery.data?.items.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.tradeName || entity.legalName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} className="min-h-[110px] w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px]" placeholder="Descricao" disabled={!canReview} />
                  <textarea value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} className="min-h-[90px] w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px]" placeholder="Notas internas" disabled={!canReview} />
                </div>

                <div className="space-y-4">
                  <SectionHeader title="Fonte original" desc="AI event, anexos e retorno bruto da execucao." />
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="text-[12px] font-medium">{getSourceTitle(detail)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {getSourceActor(detail)} · {formatDateTime(detail.source?.receivedAt ?? detail.sourceEmail?.receivedAt ?? null)}
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-[12px] leading-6 text-foreground/90">{getSourceBody(detail)}</pre>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Anexos</div>
                    <div className="space-y-2">
                      {attachments.length ? (
                        attachments.map((attachment) => (
                          <div key={attachment.id} className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="font-medium text-[12px]">{attachment.title}</div>
                            <div className="text-[11px] text-muted-foreground">{attachment.subtitle}</div>
                            {attachment.body ? (
                              <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] text-muted-foreground">{attachment.body}</pre>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
                          No attachment metadata.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">AI run</div>
                    <div className="space-y-2">
                      {runs.length ? (
                        runs.map((run) => (
                          <div key={run.id} className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-[12px]">{run.title}</div>
                              <StatusBadge status={humanStatus(run.status)} />
                            </div>
                            {run.errorMessage ? <div className="mt-1 text-[11px] text-destructive">{run.errorMessage}</div> : null}
                            {run.payload ? (
                              <pre className="mt-2 overflow-x-auto rounded-md bg-background px-2 py-2 text-[11px] text-muted-foreground">
                                {JSON.stringify(run.payload, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
                          No AI run data.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">OMIE</div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          Export manual only after approval.
                        </div>
                      </div>
                      {latestOmieSync ? <StatusBadge status={humanStatus(latestOmieSync.status)} /> : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["HOMOLOG", "PRODUCTION"] as const).map((environment) => (
                        <button
                          key={environment}
                          onClick={() => setOmieEnvironment(environment)}
                          className={cn(
                            "h-8 px-2.5 rounded-md border text-[12px]",
                            omieEnvironment === environment ? "border-ai/40 bg-ai/10 text-ai" : "border-border hover:bg-accent"
                          )}
                        >
                          {environment === "HOMOLOG" ? "Homolog" : "Prod"}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 rounded-lg border border-border bg-card px-3 py-3 text-[12px]">
                      <div>Status atual: {latestOmieSync ? humanStatus(latestOmieSync.status) : "Sem exportacao"}</div>
                      <div className="mt-1 text-muted-foreground">
                        ID externo: {latestOmieSync?.externalId ?? "-"}
                      </div>
                      {latestOmieSync?.errorMessage ? (
                        <div className="mt-2 text-destructive">{latestOmieSync.errorMessage}</div>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-2">
                      {detail.omieHistory.requests.length ? (
                        detail.omieHistory.requests.slice(0, 4).map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[12px] font-medium">{entry.method} {entry.endpoint.split("/api/v1/")[1] ?? entry.endpoint}</div>
                              <StatusBadge status={humanStatus(entry.operationStatus)} />
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {formatDateTime(entry.createdAt)} {entry.httpStatus ? `· HTTP ${entry.httpStatus}` : ""}
                            </div>
                            {entry.friendlyError ? <div className="mt-1 text-[11px] text-destructive">{entry.friendlyError}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
                          No OMIE request history.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={humanStatus(detail.routingStatus)} />
                    <StatusBadge status={detail.routeSource} />
                    <StatusBadge status={detail.legalEntityName ?? "Sem entidade"} />
                  </div>
                  {detail.routingReason ? <div className="mt-2 text-[12px] text-muted-foreground">{detail.routingReason}</div> : null}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/60 p-4">
                <SectionHeader title="Historico de revisao" desc="Toda alteracao fica auditada." />
                <div className="space-y-2">
                  {detail.reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border border-border bg-card px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-[12px]">
                          {review.user.name} · {review.action}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{formatDateTime(review.createdAt)}</div>
                      </div>
                      {review.note ? <div className="mt-1 text-[12px] text-muted-foreground">{review.note}</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="min-h-[90px] w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px]" placeholder="Motivo de rejeicao, ou nota de aprovacao." disabled={!canReview} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => saveMutation.mutate()} disabled={!canReview || saveMutation.isPending} data-testid="draft-save-button" className="h-9 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-accent disabled:opacity-60">
                    <Save className="size-3.5" /> Salvar ajustes
                  </button>
                  <button onClick={() => approveMutation.mutate()} disabled={!canReview || approveMutation.isPending} data-testid="draft-approve-button" className="h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60">
                    <CheckCircle2 className="size-3.5" /> Aprovar
                  </button>
                  <button
                    onClick={() => exportOmieMutation.mutate()}
                    disabled={!canReview || exportOmieMutation.isPending || detail.status !== "APROVADO"}
                    className="h-9 px-3 rounded-md border border-ai/30 text-ai text-[12.5px] inline-flex items-center gap-1.5 hover:bg-ai/5 disabled:opacity-60"
                  >
                    <Upload className="size-3.5" /> Criar no OMIE
                  </button>
                  <button onClick={() => rejectMutation.mutate()} disabled={!canReview || rejectMutation.isPending || rejectReason.trim().length < 3} data-testid="draft-reject-button" className="h-9 px-3 rounded-md border border-destructive/30 text-destructive text-[12.5px] inline-flex items-center gap-1.5 hover:bg-destructive/5 disabled:opacity-60">
                    <XCircle className="size-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
