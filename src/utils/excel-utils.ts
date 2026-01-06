export const normalizeHeader = (header: string): string => {
  if (!header) return '';
  // Remove acentos, espaços e converte para minúsculas
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s/g, '')
    .toLowerCase();
};

export const mapRowKeys = (row: any): any => {
  const normalizedRow: any = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const normalizedKey = normalizeHeader(key);
      normalizedRow[normalizedKey] = row[key];
    }
  }
  return normalizedRow;
};