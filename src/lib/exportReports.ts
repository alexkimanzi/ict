import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function formatColumnHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function exportReportToPDF(title: string, rows: Array<Record<string, unknown>>): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('AKHIM ICT Support Desk', 32, 28);

  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`${title} · Generated ${new Date().toLocaleString()}`, 32, 46);

  if (rows.length === 0) {
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(12);
    doc.text('No records available for the selected report.', 32, 100);
  } else {
    const keys = Object.keys(rows[0]);
    const head = [keys.map(formatColumnHeader)];
    const body = rows.map((row) =>
      keys.map((k) => {
        const val = row[k];
        return val === null || val === undefined ? '—' : String(val);
      })
    );

    autoTable(doc, {
      head,
      body,
      startY: 82,
      margin: { left: 32, right: 32 },
      styles: {
        fontSize: 8,
        cellPadding: 5,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export function exportReportToExcel(title: string, rows: Array<Record<string, unknown>>): void {
  const formattedRows = rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      clean[formatColumnHeader(key)] = value ?? '';
    }
    return clean;
  });

  const worksheet = XLSX.utils.json_to_sheet(
    formattedRows.length > 0 ? formattedRows : [{ Notice: 'No records available' }]
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
