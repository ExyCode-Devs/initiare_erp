import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CopyMinus, FileText, RefreshCcw, Save, ShieldAlert, XCircle } from "lucide-react";
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
import {
  getDisplayStatus,
  humanFinancialStatus,
  humanReviewAction,
  humanRouteSource,
  humanRoutingReason,
} from "@/lib/status-labels";
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
  head: () => ({ meta: [{ title: "Validação Financeira · Veridia" }] }),
  component: ValidacaoFinanceiraPage,
});

function formatDateTime(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function getApprovalGateSnapshot(detail: FinancialDraftDetailResponse) {
  const execution = detail.review.execution;

  if (execution?.status === "queued") {
    return {
      status: "Na fila local",
      nextAction: "Aguardando worker ou execucao manual.",
      externalState: "Nao concluido no ERP",
    };
  }

  if (execution?.status === "running") {
    return {
      status: "Executando integracao",
      nextAction: "Fluxo em andamento.",
      externalState: "Processando no ERP",
    };
  }

  if (execution?.status === "success") {
    return {
      status: "Concluido",
      nextAction: "Registro sincronizado.",
      externalState: "Criado no ERP",
    };
  }

  if (execution?.status === "error") {
    return {
      status: "Erro de execucao",
      nextAction: "Corrigir e reenviar execucao.",
      externalState: "Falha no ERP",
    };
  }

  if (detail.review.workflowStatus === "duplicated") {
    return {
      status: "Bloqueado por duplicidade",
      nextAction: "Desfazer duplicado ou manter rejeitado.",
      externalState: "Nao enviado",
    };
  }

  if (detail.review.workflowStatus === "rejected") {
    return {
      status: "Rejeitado",
      nextAction: "Sem envio externo.",
      externalState: "Nao enviado",
    };
  }

  if (detail.review.blockers.length > 0) {
    return {
      status: "Bloqueado",
      nextAction: "Corrigir campos e remover blockers.",
      externalState: "Nao enviado",
    };
  }

  if (detail.review.canApprove) {
    return {
      status: "Pronto para aprovacao",
      nextAction: "Pode aprovar quando revisar os dados.",
      externalState: "Nao enviado",
    };
  }

  return {
    status: "Em revisão",
    nextAction: "Análise humana pendente.",
    externalState: "Não enviado",
  };
}

function getSourceTitle(detail: FinancialDraftDetailResponse) {
  return detail.source?.subject ?? detail.sourceEmail?.subject ?? detail.source?.channel ?? "Evento IA";
}

function getSourceActor(detail: FinancialDraftDetailResponse) {
  return detail.source?.sender ?? detail.sourceEmail?.sender ?? detail.source?.channel ?? "Evento IA";
}

function getSourceBody(detail: FinancialDraftDetailResponse) {
  return detail.source?.summary ?? detail.sourceEmail?.bodyText ?? "Nenhum resumo da fonte disponivel.";
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
      title: `Anexo ${index + 1}`,
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

  const retryExecutionMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/financial-drafts/${selectedDraftId}/retry-execution`, {
        method: "POST",
        body: {
          environment: "HOMOLOG",
        },
      }),
    onSuccess: refreshAll,
  });

  const markDuplicateMutation = useMutation({
    mutationFn: (duplicateOfId: string) =>
      apiRequest(`/financial-drafts/${selectedDraftId}/mark-duplicate`, {
        method: "POST",
        body: {
          duplicateOfId,
          note: rejectReason || "Marcado como duplicado durante revisao",
        },
      }),
    onSuccess: refreshAll,
  });

  const undoDuplicateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/financial-drafts/${selectedDraftId}/undo-duplicate`, {
        method: "POST",
      }),
    onSuccess: refreshAll,
  });

  const reprocessMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/financial-drafts/${selectedDraftId}/request-reprocess`, {
        method: "POST",
        body: {
          note: rejectReason || null,
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
        <InlineState label="Carregando fila de validação..." />
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
  const execution = detail?.review.execution ?? null;
  const approvalGate = detail ? getApprovalGateSnapshot(detail) : null;

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Validação Financeira"
        desc="Fila humana para editar, aprovar ou rejeitar pré-entradas vindas do intake financeiro."
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
                      {item.source?.subject ?? item.email?.subject ?? item.source?.channel ?? "Evento IA"}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{item.amount ? formatCurrency(item.amount) : "Sem valor"}</span>
                      <span>·</span>
                      <span>{item.dueDate ? item.dueDate.slice(0, 10) : "Sem vencimento"}</span>
                    </div>
                  </div>
                    <div className="text-right">
                      <StatusBadge status={getDisplayStatus(item.status, item.review.workflowStatus)} />
                    </div>
                  </div>
                  {item.review.blockers.length ? (
                    <div className="mt-2 text-[11px] text-warning">
                      {item.review.blockers[0]?.message}
                    </div>
                  ) : null}
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
                <div className="text-right">
                  <StatusBadge status={getDisplayStatus(detail.status, detail.review.workflowStatus)} />
                </div>
              </div>

              {approvalGate ? (
                <div className="rounded-xl border border-border bg-background/60 p-4" data-testid="draft-approval-gate">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Validacao para aprovacao</div>
                      <div className="mt-1 text-[16px] font-semibold">{approvalGate.status}</div>
                    </div>
                    <StatusBadge status={approvalGate.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                    <div className="rounded-lg border border-border bg-card px-3 py-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Proximo passo</div>
                      <div className="mt-1">{approvalGate.nextAction}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-3 py-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Estado externo</div>
                      <div className="mt-1">{approvalGate.externalState}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-3 py-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Workflow</div>
                      <div className="mt-1">{humanFinancialStatus(detail.review.workflowStatus)}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {detail.review.blockers.length ? (
                <div className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-warning">Bloqueios de aprovacao</div>
                  <div className="mt-2 space-y-1 text-[12px] text-warning">
                    {detail.review.blockers.map((blocker) => (
                      <div key={blocker.code}>{blocker.message}</div>
                    ))}
                  </div>
                </div>
              ) : null}

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
                  <SectionHeader title="Campos extraidos" desc="App valida e decide. Inbox e adaptadores alimentam a mesma fila revisavel." />
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
                  <SectionHeader title="Fonte original" desc="Evento IA, anexos e retorno bruto da execucao." />
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
                          Nenhum metadado de anexo.
                        </div>
                      )}
                    </div>
                  </div>

                    <div className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Execucao IA</div>
                      <div className="space-y-2">
                      {runs.length ? (
                        runs.map((run) => (
                          <div key={run.id} className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-[12px]">{run.title}</div>
                              <StatusBadge status={humanFinancialStatus(run.status)} />
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
                            Nenhum dado de execucao da IA.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Candidatos a duplicata</div>
                      <div className="space-y-2">
                        {detail.review.duplicateCandidates.length ? (
                          detail.review.duplicateCandidates.map((candidate) => (
                            <div key={candidate.id} className="rounded-lg border border-border bg-card px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-medium text-[12px]">{candidate.partyName}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    score {candidate.score} · {candidate.amount ? formatCurrency(candidate.amount) : "Sem valor"}
                                  </div>
                                </div>
                                {canReview ? (
                                  <button
                                    onClick={() => markDuplicateMutation.mutate(candidate.id)}
                                    className="h-8 px-2.5 rounded-md border border-warning/30 text-warning text-[12px] hover:bg-warning/5"
                                  >
                                    Marcar duplicado
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
                            Nenhum candidato a duplicata encontrado.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fluxo de execucao</div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          A aprovacao enfileira a execucao. A criacao no provedor espelha os registros locais apos retorno do OMIE.
                        </div>
                      </div>
                      {execution ? <StatusBadge status={humanFinancialStatus(execution.status)} /> : null}
                    </div>

                    <div className="mt-3 rounded-lg border border-border bg-card px-3 py-3 text-[12px]">
                      <div>Status atual: {execution ? humanFinancialStatus(execution.status) : "Sem execução"}</div>
                      <div className="mt-1 text-muted-foreground">
                        Ambiente: {execution?.environment ?? "HOMOLOG"}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        ID externo: {execution?.externalEntryId ?? latestOmieSync?.externalId ?? "-"}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        Parte externa: {execution?.externalPartyId ?? "-"}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        Tentativas: {String(execution?.retryCount ?? 0)}
                      </div>
                      {execution?.lastError ? (
                        <div className="mt-2 text-destructive">{execution.lastError}</div>
                      ) : latestOmieSync?.errorMessage ? (
                        <div className="mt-2 text-destructive">{latestOmieSync.errorMessage}</div>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-2">
                      {detail.omieHistory.requests.length ? (
                        detail.omieHistory.requests.slice(0, 4).map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[12px] font-medium">{entry.method} {entry.endpoint.split("/api/v1/")[1] ?? entry.endpoint}</div>
                              <StatusBadge status={humanFinancialStatus(entry.operationStatus)} />
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {formatDateTime(entry.createdAt)} {entry.httpStatus ? `· HTTP ${entry.httpStatus}` : ""}
                            </div>
                            {entry.friendlyError ? <div className="mt-1 text-[11px] text-destructive">{entry.friendlyError}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
                          Nenhum historico de requisicoes OMIE.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={humanFinancialStatus(detail.routingStatus)} />
                    <StatusBadge status={humanRouteSource(detail.routeSource)} />
                    <StatusBadge status={detail.legalEntityName ?? "Sem entidade"} />
                  </div>
                  {detail.routingReason ? (
                    <div className="mt-2 text-[12px] text-muted-foreground">{humanRoutingReason(detail.routingReason)}</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/60 p-4">
                <SectionHeader title="Historico de revisao" desc="Toda alteracao fica auditada." />
                <div className="space-y-2">
                  {detail.reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border border-border bg-card px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-[12px]">
                          {review.user.name} · {humanReviewAction(review.action)}
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
                  <button onClick={() => approveMutation.mutate()} disabled={!canReview || approveMutation.isPending || !detail.review.canApprove} data-testid="draft-approve-button" className="h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60">
                    <CheckCircle2 className="size-3.5" /> Aprovar e seguir fluxo
                  </button>
                  <button
                    onClick={() => reprocessMutation.mutate()}
                    disabled={!canReview || reprocessMutation.isPending}
                    className="h-9 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-accent disabled:opacity-60"
                  >
                    <RefreshCcw className="size-3.5" /> Pedir reprocesso
                  </button>
                  <button
                    onClick={() => undoDuplicateMutation.mutate()}
                    disabled={!canReview || undoDuplicateMutation.isPending || detail.review.workflowStatus !== "duplicated"}
                    className="h-9 px-3 rounded-md border border-info/30 text-info text-[12.5px] inline-flex items-center gap-1.5 hover:bg-info/5 disabled:opacity-60"
                  >
                    <CopyMinus className="size-3.5" /> Desfazer duplicado
                  </button>
                  <button
                    onClick={() => retryExecutionMutation.mutate()}
                    disabled={!canReview || retryExecutionMutation.isPending || detail.review.execution?.status !== "error"}
                    className="h-9 px-3 rounded-md border border-ai/30 text-ai text-[12.5px] inline-flex items-center gap-1.5 hover:bg-ai/5 disabled:opacity-60"
                  >
                    <RefreshCcw className="size-3.5" /> Reenviar execucao
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
