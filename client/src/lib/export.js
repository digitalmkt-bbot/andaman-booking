import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportCSV(filename, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  saveAs(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

export function exportXLSX(filename, rows, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPDF(filename, title, columns, rows) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [columns],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [27, 111, 245] },
  });
  doc.save(`${filename}.pdf`);
}

export function printTable(title, columns, rows) {
  const w = window.open('', '_blank');
  if (!w) return;
  const head = columns.map((c) => `<th>${c}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('');
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      body{font-family:sans-serif;padding:20px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:6px;font-size:12px;text-align:left}
      th{background:#1b6ff5;color:#fff}
      h1{font-size:18px}
    </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  w.document.close();
  w.print();
}
