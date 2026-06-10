import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, FileStack, FileText, Layers3, Link2 } from "lucide-react";
import { Card, PageHeader, SectionHeader, Stat, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import type { AdvancedOpsOverviewResponse, PortalOverviewResponse } from "@/lib/api-types";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/advanced-ops")({
  head: () => ({ meta: [{ title: "Advanced Ops" }] }),
  component: AdvancedOpsPage,
});

function AdvancedOpsPage() {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedLegalEntityId, setSelectedLegalEntityId] = useState("");
  const [portalToken, setPortalToken] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["advanced-ops-overview"],
    queryFn: () => apiRequest<AdvancedOpsOverviewResponse>("/advanced-ops/overview"),
  });

  const selectedClientName = useMemo(
    () => overviewQuery.data?.businessClients.find((item) => item.id === selectedClientId)?.name ?? "Cliente demo",
    [overviewQuery.data, selectedClientId],
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["advanced-ops-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["financial-drafts"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    ]);
  };

  const contractMutation = useMutation({
    mutationFn: () =>
      apiRequest("/advanced-ops/contracts/generate-drafts", {
        method: "POST",
        body: {
          contracts: [
            {
              originId: `demo-contract-${selectedClientId || "default"}`,
              businessClientId: selectedClientId || overviewQuery.data?.businessClients[0]?.id,
              businessClientName: selectedClientName,
              amount: 1250,
              dueDate: new Date().toISOString(),
              category: "Receita recorrente",
              description: "Cobranca recorrente do contrato demo",
              scheduleReason: "monthly_due",
              tags: ["recorrente", "demo"],
            },
          ],
          allocationRule: selectedLegalEntityId
            ? {
                strategy: "MANUAL",
                legalEntityId: selectedLegalEntityId,
              }
            : null,
        },
      }),
    onSuccess: refresh,
  });

  const serviceOrderMutation = useMutation({
    mutationFn: () =>
      apiRequest("/advanced-ops/service-orders/generate-drafts", {
        method: "POST",
        body: {
          serviceOrders: [
            {
              originId: `demo-os-${selectedClientId || "default"}`,
              businessClientId: selectedClientId || overviewQuery.data?.businessClients[0]?.id,
              businessClientName: selectedClientName,
              amount: 840,
              dueDate: new Date().toISOString(),
              category: "Projeto",
              description: "OS faturavel demo",
              faturavel: true,
              tags: ["os", "demo"],
            },
          ],
          allocationRule: selectedLegalEntityId
            ? {
                strategy: "MANUAL",
                legalEntityId: selectedLegalEntityId,
              }
            : null,
        },
      }),
    onSuccess: refresh,
  });

  const reconciliationMutation = useMutation({
    mutationFn: () =>
      apiRequest("/advanced-ops/reconciliation/create-draft", {
        method: "POST",
        body: {
          movement: {
            id: `demo-movement-${selectedClientId || "default"}`,
            direction: "IN",
            amount: 315,
            description: "Credito identificado demo",
            occurredAt: new Date().toISOString(),
            suggestedPartyName: selectedClientName,
          },
          candidates: [],
          knownFeeLabels: ["taxa", "asaas fee"],
          legalEntityId: selectedLegalEntityId || null,
        },
      }),
    onSuccess: refresh,
  });

  const portalTokenMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ token: string }>("/advanced-ops/portal/access-token", {
        method: "POST",
        body: {
          clientId: selectedClientId || overviewQuery.data?.businessClients[0]?.id,
          expiresInHours: 24,
        },
      }),
    onSuccess: (data) => setPortalToken(data.token),
  });

  const portalOverviewQuery = useQuery({
    queryKey: ["portal-overview-preview", portalToken],
    queryFn: () =>
      apiRequest<PortalOverviewResponse>("/portal/overview", {
        headers: {
          authorization: `Bearer ${portalToken}`,
        },
      }),
    enabled: Boolean(portalToken),
  });

  if (overviewQuery.isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando advanced ops..." /></div>;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar advanced ops." /></div>;
  }

  const data = overviewQuery.data;

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Advanced Ops"
        desc="Contracts, OS, reconciliation, BI, and portal all feed the same reviewed pre-entry flow."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Due contracts" value={String(data.summary.dueContracts)} accent="ai" icon={<FileText className="size-4" />} />
        <Stat label="Due OS" value={String(data.summary.dueServiceOrders)} accent="info" icon={<FileStack className="size-4" />} />
        <Stat label="Reconciliation" value={String(data.summary.reconciliationCount)} accent="warning" icon={<Layers3 className="size-4" />} />
        <Stat label="Approved drafts" value={String(data.summary.approvedDrafts)} accent="success" icon={<Link2 className="size-4" />} />
        <Stat label="Receivable volume" value={formatCurrency(data.summary.receivableVolume)} accent="ai" icon={<Building2 className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-6 p-5 space-y-4">
          <SectionHeader title="Generators" desc="Create reviewable drafts, never definitive billing directly." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]">
              <option value="">Escolha um cliente</option>
              {data.businessClients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <select value={selectedLegalEntityId} onChange={(event) => setSelectedLegalEntityId(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]">
              <option value="">Entidade padrao</option>
              {data.legalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.tradeName || entity.legalName}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => contractMutation.mutate()} disabled={contractMutation.isPending} className="h-9 px-3 rounded-md border border-border text-[12.5px] hover:bg-accent disabled:opacity-60">
              Gerar draft de contrato
            </button>
            <button onClick={() => serviceOrderMutation.mutate()} disabled={serviceOrderMutation.isPending} className="h-9 px-3 rounded-md border border-border text-[12.5px] hover:bg-accent disabled:opacity-60">
              Gerar draft de OS
            </button>
            <button onClick={() => reconciliationMutation.mutate()} disabled={reconciliationMutation.isPending} className="h-9 px-3 rounded-md border border-border text-[12.5px] hover:bg-accent disabled:opacity-60">
              Criar draft de conciliacao
            </button>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Latest advanced-flow drafts</div>
            <div className="space-y-2">
              {data.latestDrafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border border-border bg-card px-3 py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-medium">{draft.partyName}</div>
                    <div className="text-[11px] text-muted-foreground">{draft.sourceLabel}</div>
                  </div>
                  <StatusBadge status={draft.status} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-6 p-5 space-y-4">
          <SectionHeader title="Portal" desc="Mint read-only client-scoped token, then preview that exact slice." />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => portalTokenMutation.mutate()} disabled={portalTokenMutation.isPending} className="h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] disabled:opacity-60">
              Gerar token portal
            </button>
          </div>
          <textarea value={portalToken ?? ""} readOnly className="min-h-[110px] w-full rounded-md border border-border bg-background px-3 py-2 text-[11px]" placeholder="Portal token aparece aqui" />
          {portalOverviewQuery.isLoading ? <InlineState label="Carregando preview portal..." /> : null}
          {portalOverviewQuery.data ? (
            <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
              <div className="text-[12px] font-medium">{portalOverviewQuery.data.client.name}</div>
              <div className="text-[12px] text-muted-foreground">
                {portalOverviewQuery.data.stats.totalReceivables} recebiveis, {formatCurrency(portalOverviewQuery.data.stats.totalVolume)}
              </div>
              <div className="space-y-2">
                {portalOverviewQuery.data.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px]">{formatCurrency(item.amount)}</div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{item.source} · {item.channel}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
