export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});

export function formatCurrency(value: number) {
  return brl.format(value);
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}
