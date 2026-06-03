import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, LockKeyhole, Mail } from "lucide-react";
import { Card } from "@/components/app/primitives";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/"
  }),
  component: LoginPage
});

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const search = Route.useSearch();
  const [email, setEmail] = useState("admin@veridia.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      await navigate({ to: search.redirect || "/" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel autenticar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,23,42,1))] text-white px-6 py-10">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_420px] gap-8 items-center min-h-[calc(100vh-5rem)]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/70">
            Finance OS
          </div>
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-5xl leading-tight font-semibold tracking-tight">
              O cockpit financeiro agora opera com API, banco e autenticacao reais.
            </h1>
            <p className="text-base text-white/70 leading-7">
              Entre com o usuario inicial para validar dashboard, operacoes, automacoes, excecoes e metricas de monitoramento do MVP.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 max-w-3xl">
            {[
              { title: "Postgres", desc: "Persistencia real com migrations Prisma." },
              { title: "API dedicada", desc: "Fastify, JWT, RBAC e metricas." },
              { title: "Observabilidade", desc: "Logs estruturados e resumo operacional." }
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-sm text-white/65 mt-2 leading-6">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-white/10 bg-slate-950/80 text-white shadow-2xl">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-white/50">Acesso seguro</div>
              <h2 className="text-2xl font-semibold mt-2">Entrar no Veridia</h2>
              <p className="text-sm text-white/60 mt-2">
                Use o usuario seed inicial e altere as credenciais antes do acesso do cliente.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-white/75">E-mail</span>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3">
                <Mail className="size-4 text-white/45" />
                <input
                  data-testid="login-email"
                  className="h-12 flex-1 bg-transparent outline-none text-sm"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-white/75">Senha</span>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3">
                <LockKeyhole className="size-4 text-white/45" />
                <input
                  data-testid="login-password"
                  className="h-12 flex-1 bg-transparent outline-none text-sm"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              data-testid="login-submit"
              className="w-full h-12 rounded-xl bg-white text-slate-950 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-70"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
