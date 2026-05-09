/**
 * Minimal CSV emitter. Quotes any field containing comma, quote, or newline,
 * doubles internal quotes, normalizes nullish to empty string.
 */
export function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (value instanceof Date) str = value.toISOString();
  else if (typeof value === "object") str = JSON.stringify(value);
  else str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
