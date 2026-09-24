import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportOptions {
  title: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  metaInfo?: Record<string, string>;
}

// Export to Excel (.xlsx)
export function exportToExcel({ title, filename, headers, rows, metaInfo }: ExportOptions): boolean {
  try {
    const dataWithMeta: any[][] = [];

    // Title & Meta information
    dataWithMeta.push([title]);
    dataWithMeta.push([`Generated On: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`]);
    if (metaInfo) {
      Object.entries(metaInfo).forEach(([k, v]) => {
        dataWithMeta.push([`${k}: ${v}`]);
      });
    }
    dataWithMeta.push([]); // blank row
    dataWithMeta.push(headers);

    rows.forEach(r => dataWithMeta.push(r));

    const ws = XLSX.utils.aoa_to_sheet(dataWithMeta);

    // Auto calculate column widths
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach(r => {
        const valStr = String(r[i] || "");
        if (valStr.length > maxLen) maxLen = Math.min(valStr.length, 45);
      });
      return { wch: Math.max(maxLen + 3, 12) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    return true;
  } catch (err) {
    console.error("Failed to export Excel:", err);
    return false;
  }
}

// Export to CSV (.csv) with UTF-8 BOM
export function exportToCSV({ filename, headers, rows }: ExportOptions): boolean {
  try {
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","),
        ...rows.map(r => r.map(cell => `"${String(cell !== undefined && cell !== null ? cell : "").replace(/"/g, '""')}"`).join(","))
      ].join("\r\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error("Failed to export CSV:", err);
    return false;
  }
}

// Export to PDF (.pdf) using jsPDF & autoTable
export function exportToPDF({ title, filename, headers, rows, metaInfo }: ExportOptions): boolean {
  try {
    const doc = new jsPDF({
      orientation: headers.length > 6 ? "landscape" : "portrait",
      unit: "pt",
      format: "a4"
    });

    // Header Branding
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, doc.internal.pageSize.width, 45, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(title, 20, 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);

    let startY = 60;
    const metaEntries = metaInfo ? Object.entries(metaInfo) : [];
    if (metaEntries.length > 0) {
      const metaText = metaEntries.map(([k, v]) => `${k}: ${v}`).join("   |   ");
      doc.text(metaText, 20, startY);
      startY += 15;
    }

    doc.text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)   |   Total Records: ${rows.length}`, 20, startY);
    startY += 15;

    autoTable(doc, {
      startY: startY,
      head: [headers],
      body: rows.map(r => r.map(c => String(c !== undefined && c !== null ? c : ""))),
      theme: "striped",
      headStyles: {
        fillColor: [37, 99, 235], // Blue 600
        textColor: 255,
        fontSize: 8,
        fontStyle: "bold",
        halign: "left"
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59],
        cellPadding: 4
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: 20, right: 20, bottom: 20, left: 20 }
    });

    doc.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error("Failed to export PDF:", err);
    return false;
  }
}

// Print Preview
export function triggerPrintReport({ title, headers, rows, metaInfo }: ExportOptions): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  const metaHtml = metaInfo
    ? Object.entries(metaInfo)
        .map(([k, v]) => `<span style="margin-right: 20px; font-weight: 600; color: #475569;">${k}: <span style="color: #0f172a;">${v}</span></span>`)
        .join("")
    : "";

  const tableHeaderHtml = headers.map(h => `<th style="border: 1px solid #cbd5e1; padding: 8px 10px; background-color: #f1f5f9; color: #1e293b; text-align: left; font-size: 11px; text-transform: uppercase;">${h}</th>`).join("");

  const tableBodyHtml = rows
    .map(
      r =>
        `<tr style="border-bottom: 1px solid #e2e8f0;">` +
        r.map(c => `<td style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 11px; color: #334155;">${c !== undefined && c !== null ? c : "—"}</td>`).join("") +
        `</tr>`
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #0f172a; }
          h2 { margin: 0 0 8px 0; color: #1e293b; font-size: 20px; }
          .meta { font-size: 12px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          @media print {
            body { padding: 0; }
            @page { margin: 1cm; size: landscape; }
          }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        <div class="meta">
          ${metaHtml}
          <div style="margin-top: 6px; color: #64748b; font-size: 11px;">
            Printed On: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST | Total Entries: ${rows.length}
          </div>
        </div>
        <table>
          <thead><tr>${tableHeaderHtml}</tr></thead>
          <tbody>${tableBodyHtml}</tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
