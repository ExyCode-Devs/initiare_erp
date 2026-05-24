import type { ContaAPagar } from '../../../types/contas';

// In-memory store for development/testing. Replace with DB in production.
const store: Record<string, ContaAPagar> = {};

function safeParseDate(d: unknown) {
  const s = String(d ?? '');
  const date = new Date(s);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || !body.id) {
      return new Response(JSON.stringify({ error: 'Invalid payload, missing id' }), { status: 400 });
    }

    const conta = body as ContaAPagar;
    conta.confianca = Math.max(0, Math.min(100, Number(conta.confianca ?? 0)));
    conta.vencimento = safeParseDate(conta.vencimento);
    store[conta.id] = conta;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('webhook POST error', err);
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
  }
}

export async function GET() {
  try {
    const arr = Object.values(store).sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
    return new Response(JSON.stringify(arr), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('webhook GET error', err);
    return new Response(JSON.stringify([]), { status: 500 });
  }
}

