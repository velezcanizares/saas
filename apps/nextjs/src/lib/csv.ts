/**
 * Parser CSV mínimo (sin dependencias). Soporta comillas dobles, comas dentro
 * de campos entre comillas, comillas escapadas ("") y saltos de línea CRLF/LF.
 * Devuelve una matriz de filas de strings (incluye la fila de encabezados).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  // Quita el BOM inicial si viene (Excel lo agrega).
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // Cierra la fila. Salta el \n de un \r\n.
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += c;
    }
  }

  // Última fila si el archivo no termina en salto de línea.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Descarta filas totalmente vacías.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Convierte un texto de precio chileno ("$14.990", "14990") a entero. */
export function parseCLPInt(raw: string | undefined): number | null {
  if (raw == null) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return null;
  return parseInt(digits, 10);
}
