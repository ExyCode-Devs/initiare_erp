export type StatusConta = 'Processado' | 'Em revisão' | 'Exceção' | 'Conciliado' | 'Pendente';

export interface ContaAPagar {
  id: string;
  fornecedor: string;
  valor: number;
  vencimento: string; // ISO date string
  categoria: string;
  status: StatusConta;
  confianca: number; // 0 - 100
}

