import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellDot, BookOpen, PencilLine, Plus, Rocket, Save, Sparkles } from "lucide-react";
import { Card, PageHeader, SectionHeader, StatusBadge } from "@/components/app/primitives";
import { InlineError, InlineState } from "@/components/app/state";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";
import type { ChangelogAdminResponse, ChangelogPublicResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type EntryFormState = {
  title: string;
  version: string;
  category: string;
  description: string;
  imageUrl: string;
  status: "RASCUNHO" | "PUBLICADO";
};

const emptyEntry: EntryFormState = {
  title: "",
  version: "",
  category: "MELHORIA",
  description: "",
  imageUrl: "",
  status: "RASCUNHO",
};

const categories = [
  "NOVA_FUNCIONALIDADE",
  "MELHORIA",
  "CORRECAO",
  "INTEGRACAO",
  "IA",
  "DASHBOARD",
] as const;

export const Route = createFileRoute("/novidades")({
  head: () => ({ meta: [{ title: "Novidades · Veridia" }] }),
  component: NovidadesPage,
});

function prettyCategory(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Rascunho";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function NovidadesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<"timeline" | "manage">("timeline");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<EntryFormState>(emptyEntry);

  const publicQuery = useQuery({
    queryKey: ["public-changelog"],
    queryFn: () => apiRequest<ChangelogPublicResponse>("/changelog"),
  });

  const adminQuery = useQuery({
    queryKey: ["admin-changelog"],
    queryFn: () => apiRequest<ChangelogAdminResponse>("/admin/changelog"),
    enabled: isAdmin,
  });

  const selectedAdminItem = useMemo(
    () => adminQuery.data?.items.find((item) => item.id === editingId) ?? null,
    [adminQuery.data, editingId],
  );
  const adminItems = adminQuery.data?.items ?? [];

  useEffect(() => {
    if (!selectedAdminItem) {
      return;
    }

    setFormState({
      title: selectedAdminItem.title,
      version: selectedAdminItem.version,
      category: selectedAdminItem.category,
      description: selectedAdminItem.description,
      imageUrl: selectedAdminItem.imageUrl ?? "",
      status: selectedAdminItem.status as "RASCUNHO" | "PUBLICADO",
    });
  }, [selectedAdminItem]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["public-changelog"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-changelog"] }),
    ]);
  };

  const markSeenMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/changelog/${id}/mark-seen`, {
        method: "POST",
      }),
    onSuccess: refreshAll,
  });

  const saveEntryMutation = useMutation({
    mutationFn: () => {
      const body = {
        title: formState.title,
        version: formState.version,
        category: formState.category,
        description: formState.description,
        imageUrl: formState.imageUrl || null,
        status: formState.status,
      };

      if (editingId) {
        return apiRequest(`/admin/changelog/${editingId}`, {
          method: "PATCH",
          body,
        });
      }

      return apiRequest(`/admin/changelog`, {
        method: "POST",
        body,
      });
    },
    onSuccess: async () => {
      if (!editingId) {
        setFormState(emptyEntry);
      }
      await refreshAll();
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/admin/changelog/${id}/publish`, {
        method: "POST",
      }),
    onSuccess: refreshAll,
  });

  if (publicQuery.isLoading || (isAdmin && adminQuery.isLoading)) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineState label="Carregando novidades..." />
      </div>
    );
  }

  if (
    publicQuery.isError ||
    !publicQuery.data ||
    (isAdmin && (adminQuery.isError || !adminQuery.data))
  ) {
    return (
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <InlineError label="Nao foi possivel carregar changelog." />
      </div>
    );
  }

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Central de Novidades"
        desc="Timeline do produto para cliente e equipe. Admin publica, usuarios leem."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "h-9 px-3 rounded-md border text-[12.5px] inline-flex items-center gap-1.5",
                activeTab === "timeline"
                  ? "border-ai/40 bg-ai/10 text-ai"
                  : "border-border hover:bg-accent",
              )}
            >
              <BookOpen className="size-3.5" /> Timeline
            </button>
            {isAdmin ? (
              <button
                onClick={() => setActiveTab("manage")}
                className={cn(
                  "h-9 px-3 rounded-md border text-[12.5px] inline-flex items-center gap-1.5",
                  activeTab === "manage"
                    ? "border-info/40 bg-info/10 text-info"
                    : "border-border hover:bg-accent",
                )}
              >
                <PencilLine className="size-3.5" /> Gerenciar
              </button>
            ) : null}
          </div>
        }
      />

      {activeTab === "timeline" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            {publicQuery.data.items.map((item) => (
              <Card key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={prettyCategory(item.category)} />
                      <span className="text-[11px] text-muted-foreground">v{item.version}</span>
                      {item.unread ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                          <BellDot className="size-3" /> Novo
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-[18px] font-semibold tracking-tight">{item.title}</h2>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {item.author.name} · {formatDateTime(item.publishedAt || item.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => markSeenMutation.mutate(item.id)}
                    className="h-8 px-2.5 rounded-md border border-border text-[12px] hover:bg-accent"
                  >
                    Marcar lido
                  </button>
                </div>
                <p className="mt-4 text-[13px] leading-6 text-foreground/90 whitespace-pre-wrap">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <SectionHeader title="Resumo do rollout" desc="Leitura rapida para cliente." />
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-[12px] font-medium">
                  <Sparkles className="size-4 text-ai" /> Novidades publicadas
                </div>
                <div className="mt-2 text-[28px] font-semibold tabular-nums">
                  {publicQuery.data.items.length}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-[12px] font-medium">
                  <Rocket className="size-4 text-info" /> Nao lidas
                </div>
                <div className="mt-2 text-[28px] font-semibold tabular-nums">
                  {publicQuery.data.items.filter((item) => item.unread).length}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-[13px] font-semibold">Entradas</div>
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormState(emptyEntry);
                }}
                className="h-8 px-2.5 rounded-md border border-border text-[12px] inline-flex items-center gap-1.5 hover:bg-accent"
              >
                <Plus className="size-3.5" /> Novo
              </button>
            </div>
            <div className="divide-y divide-border">
              {adminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setEditingId(item.id)}
                  className={cn(
                    "w-full text-left px-4 py-4 hover:bg-accent/40",
                    editingId === item.id && "bg-info/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        v{item.version} · {prettyCategory(item.category)}
                      </div>
                    </div>
                    <StatusBadge status={item.status === "PUBLICADO" ? "Processado" : "Pendente"} />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="xl:col-span-7 p-5">
            <SectionHeader
              title={editingId ? "Editar entrada" : "Nova entrada"}
              desc="Admin controla rascunho e publicacao."
            />
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveEntryMutation.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Titulo"
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                />
                <input
                  value={formState.version}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, version: event.target.value }))
                  }
                  placeholder="Versao"
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                />
                <select
                  value={formState.category}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, category: event.target.value }))
                  }
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {prettyCategory(category)}
                    </option>
                  ))}
                </select>
                <select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as "RASCUNHO" | "PUBLICADO",
                    }))
                  }
                  className="h-9 rounded-md border border-border bg-background px-3 text-[12.5px]"
                >
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="PUBLICADO">Publicado</option>
                </select>
              </div>
              <input
                value={formState.imageUrl}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, imageUrl: event.target.value }))
                }
                placeholder="URL imagem opcional"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-[12.5px]"
              />
              <textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Descricao da entrega"
                className="min-h-[220px] w-full rounded-md border border-border bg-background px-3 py-3 text-[12.5px]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saveEntryMutation.isPending}
                  className="h-9 px-3 rounded-md bg-foreground text-background text-[12.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Save className="size-3.5" /> Salvar
                </button>
                {editingId && formState.status !== "PUBLICADO" ? (
                  <button
                    type="button"
                    onClick={() => publishMutation.mutate(editingId)}
                    disabled={publishMutation.isPending}
                    className="h-9 px-3 rounded-md border border-border text-[12.5px] inline-flex items-center gap-1.5 hover:bg-accent disabled:opacity-60"
                  >
                    <Rocket className="size-3.5" /> Publicar agora
                  </button>
                ) : null}
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
