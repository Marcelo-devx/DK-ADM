/**
 * Formata um número para o padrão de moeda brasileiro (BRL).
 */
export const formatBRL = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};