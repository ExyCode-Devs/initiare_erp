import { AlertTriangle, LoaderCircle } from "lucide-react";

export function FullScreenLoader({ label = "Carregando ambiente..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground grid place-items-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-12 rounded-2xl bg-ai/12 text-ai grid place-items-center">
          <LoaderCircle className="size-6 animate-spin" />
        </div>
        <div>
          <div className="text-[15px] font-semibold">Veridia</div>
          <div className="text-[12.5px] text-muted-foreground mt-1">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function InlineState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function InlineError({ label = "Nao foi possivel carregar os dados." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 flex items-start gap-3 text-sm text-destructive">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <span>{label}</span>
    </div>
  );
}
