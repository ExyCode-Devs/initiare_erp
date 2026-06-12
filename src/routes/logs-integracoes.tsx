import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Clock3, Globe, PlugZap, RefreshCcw, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { apiRequest } from "@/lib/api";
import type { IntegrationErrorsResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/logs-integracoes")({
  head: () => ({ meta: [{ title: "Logs Integracoes · Veridia" }] }),
  component: IntegrationLogsPage
});

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function toneBySource(sourceType: IntegrationErrorsResponse["items"][number]["sourceType"]) {
  switch (sourceType) {
    case "REQUEST":
      return "text-destructive border-destructive/20 bg-destructive/8";
    case "WEBHOOK":
      return "text-warning border-warning/20 bg-warning/8";
    case "CONNECTION":
      return "text-ai border-ai/20 bg-ai/8";
    default:
      return "text-muted-foreground border-border bg-muted/40";
  }
}

function IntegrationLogsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["integration-errors"],
    queryFn: () => apiRequest<IntegrationErrorsResponse>("/integrations/errors?limit=100"),
    refetchInterval: 10000
  });

  const items = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!query.data || !normalized) {
      return query.data?.items ?? [];
    }

    return query.data.items.filter((item) =>
      [
        item.provider,
        item.environment,
        item.sourceType,
        item.legalEntityName,
        item.title,
        item.message,
        item.technicalError,
        item.endpoint,
        item.externalEventId
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [query.data, search]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  if (query.isLoading) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineState label="Carregando erros de integracao..." /></div>;
  }

  if (query.isError || !query.data) {
    return <div className="max-w-[1480px] mx-auto px-6 py-8"><InlineError label="Nao foi possivel carregar os erros de integracao." /></div>;
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-4">
      <PageHeader
        title="Logs Integracoes"
        desc="Fila central de falhas em OMIE, ASAAS e mailbox, com polling de 10 segundos."
      />

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="Total" value={String(query.data.stats.total)} />
        <StatCard label="Requests" value={String(query.data.stats.requestErrors)} />
        <StatCard label="Webhooks" value={String(query.data.stats.webhookErrors)} />
        <StatCard label="Conexoes" value={String(query.data.stats.connectionErrors)} />
        <StatCard label="Mailbox" value={String(query.data.stats.mailboxErrors)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <PlugZap className="size-4 text-ai" />
              <span className="text-[13px] font-semibold">stream://integration-errors/live</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filtrar erros..."
                    className="h-8 pl-7 pr-2 rounded bg-background border border-border text-[12px] focus:outline-none focus:border-border-strong w-52"
                  />
                </div>
                <button
                  onClick={() => query.refetch()}
                  className="h-8 px-2 rounded border border-border text-[12px] inline-flex items-center gap-1 hover:bg-accent"
                >
                  <RefreshCcw className="size-3" />
                  Atualizar
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-10 text-sm text-muted-foreground">Nenhum erro recente.</div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors",
                      selected?.id === item.id && "bg-ai/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 rounded-md border px-2 py-1 text-[10px] font-semibold", toneBySource(item.sourceType))}>
                        {item.provider}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <Clock3 className="size-3" />
                          <span>{formatDateTime(item.occurredAt)}</span>
                          <span>{item.environment ?? "N/A"}</span>
                          <span>{item.sourceType}</span>
                        </div>
                        <div className="mt-1 font-medium text-sm">{item.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground truncate">{item.message}</div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {item.legalEntityName ?? "Sem entidade legal"}
                          {item.httpStatus ? ` · HTTP ${item.httpStatus}` : ""}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="xl:col-span-5">
          <Card className="p-0 overflow-hidden min-h-[420px]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <AlertTriangle className="size-4 text-warning" />
              <span className="text-[13px] font-semibold">Detalhe do erro</span>
            </div>

            {!selected ? (
              <div className="px-4 py-10 text-sm text-muted-foreground">Selecione um erro.</div>
            ) : (
              <div className="p-4 space-y-4 text-sm">
                <Section label="Resumo" value={selected.message} />
                <Section label="Provider" value={`${selected.provider} · ${selected.environment ?? "N/A"} · ${selected.sourceType}`} />
                <Section label="Entidade" value={selected.legalEntityName ?? "Nao vinculada"} />
                <Section label="Quando" value={formatDateTime(selected.occurredAt)} />
                <Section label="Endpoint" value={selected.endpoint ?? "N/A"} icon={<Globe className="size-3" />} />
                <Section label="Metodo / Status" value={`${selected.method ?? "N/A"}${selected.httpStatus ? ` · HTTP ${selected.httpStatus}` : ""}`} />
                <Section label="Erro tecnico" value={selected.technicalError ?? "N/A"} />
                <Section label="Draft ID" value={selected.draftId ?? "N/A"} />
                <Section label="External Event ID" value={selected.externalEventId ?? "N/A"} />
                <Section label="Connection ID" value={selected.connectionId ?? "N/A"} />
                <Section label="Mailbox ID" value={selected.mailboxId ?? "N/A"} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function Section({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 rounded border border-border bg-background px-3 py-2 text-foreground/90 break-words inline-flex items-start gap-2 w-full">
        {icon ? <span className="mt-0.5 text-muted-foreground">{icon}</span> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}
