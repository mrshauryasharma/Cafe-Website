/**
 * Safe CSV cell serialization with spreadsheet formula-injection neutralization
 * and UTF-8 BOM support for clean Excel rendering of currency symbols.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  // Neutralize formula injection characters (=, +, -, @, tab, CR) unless plain negative number
  const isPlainNegativeNumber = typeof value === 'number' || /^-\d+(\.\d+)?$/.test(str);
  const safe = !isPlainNegativeNumber && /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function downloadCsvFile(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
