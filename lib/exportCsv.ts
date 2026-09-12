/**
 * Standardized CSV Export Engine for LibraryOS
 * - Includes UTF-8 BOM (\uFEFF) so Microsoft Excel opens Hindi/Indian names,
 *   currency symbols, and phone numbers without corrupting text or stripping formatting.
 * - Safely escapes quotes, commas, and line breaks.
 */

export interface CsvExportOptions {
  filename: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

/**
 * Escapes a single cell value for CSV compliant format (RFC 4180)
 */
function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // If the cell contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates and triggers download of a CSV file
 */
export function downloadCsv({ filename, headers, rows }: CsvExportOptions): void {
  if (typeof window === "undefined") return;

  const headerLine = headers.map(escapeCsvCell).join(",");
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  
  // \uFEFF is the UTF-8 Byte Order Mark (BOM), required by Microsoft Excel to detect UTF-8 correctly
  const csvContent = "\uFEFF" + headerLine + "\r\n" + rowLines;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const cleanFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  
  link.setAttribute("href", url);
  link.setAttribute("download", cleanFilename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Free memory
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
