import { getOverpaidAmount, normalizeDate } from "./format";

function textCell(value) {
  return {
    value:
      value === null || value === undefined
        ? ""
        : String(value),
    type: String,
  };
}

function dateCell(value) {
  return textCell(normalizeDate(value) || "-");
}

function moneyCell(value) {
  return {
    value: Number(value || 0),
    type: Number,
    format: "#,##0.00",
  };
}

function buildColumns({
  includeBillingMonth,
  includeLastPayment,
}) {
  const columns = [
    {
      header: "Customer",
      width: 28,
      cell: (row) => textCell(row.customer_name),
    },
    {
      header: "STB",
      width: 16,
      cell: (row) => textCell(row.stb_number),
    },
    {
      header: "Phone",
      width: 16,
      cell: (row) => textCell(row.phone || "-"),
    },
    {
      header: "Place",
      width: 18,
      cell: (row) => textCell(row.place || "-"),
    },
    {
      header: "Assigned",
      width: 22,
      cell: (row) =>
        textCell(
          row.assigned_user_name ||
            row.assigned_username ||
            "-"
        ),
    },
    {
      header: "Package",
      width: 20,
      cell: (row) => textCell(row.package_name || "-"),
    },
    {
      header: "Billing month",
      width: 14,
      include: includeBillingMonth,
      cell: (row) => dateCell(row.billing_month),
    },
    {
      header: "Amount",
      width: 12,
      cell: (row) => moneyCell(row.monthly_amount),
    },
    {
      header: "Paid",
      width: 12,
      cell: (row) => moneyCell(row.total_paid),
    },
    {
      header: "Balance",
      width: 12,
      cell: (row) => moneyCell(row.balance_amount),
    },
    {
      header: "Overpaid",
      width: 12,
      cell: (row) => moneyCell(getOverpaidAmount(row)),
    },
    {
      header: "Last payment",
      width: 14,
      include: includeLastPayment,
      cell: (row) => dateCell(row.last_payment_date),
    },
    {
      header: "Status",
      width: 12,
      cell: (row) => textCell(row.payment_status),
    },
  ];

  return columns.filter((column) => column.include !== false);
}

export async function downloadReportExcel({
  records,
  includeBillingMonth = false,
  includeLastPayment = false,
  fileName,
  sheetName,
}) {
  if (!records.length) return false;

  const columns = buildColumns({
    includeBillingMonth,
    includeLastPayment,
  });

  const headerRow = [
    {
      value: "S.No",
      type: String,
      fontWeight: "bold",
      backgroundColor: "#f1f5f9",
    },
    ...columns.map((column) => ({
      value: column.header,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#f1f5f9",
    })),
  ];

  const dataRows = records.map((row, index) => [
    {
      value: index + 1,
      type: Number,
    },
    ...columns.map((column) => column.cell(row)),
  ]);

  const { default: writeXlsxFile } = await import(
    "write-excel-file/browser"
  );

  await writeXlsxFile([headerRow, ...dataRows], {
    sheet: sheetName,
    columns: [
      { width: 8 },
      ...columns.map((column) => ({
        width: column.width,
      })),
    ],
    stickyRowsCount: 1,
  }).toFile(fileName);

  return true;
}

export async function downloadCustomersExcel({
  customers,
  fileName,
}) {
  if (!customers.length) return false;

  const columns = [
    {
      header: "Customer",
      width: 28,
      cell: (row) => textCell(row.customer_name),
    },
    {
      header: "STB",
      width: 16,
      cell: (row) => textCell(row.stb_number),
    },
    {
      header: "Phone",
      width: 16,
      cell: (row) => textCell(row.phone || "-"),
    },
    {
      header: "Place",
      width: 18,
      cell: (row) => textCell(row.place || "-"),
    },
    {
      header: "Package",
      width: 20,
      cell: (row) => textCell(row.package_name || "-"),
    },
    {
      header: "Monthly amount",
      width: 16,
      cell: (row) =>
        moneyCell(row.package_monthly_amount),
    },
    {
      header: "Assigned",
      width: 22,
      cell: (row) =>
        textCell(
          row.assigned_user_name ||
            row.assigned_username ||
            "-"
        ),
    },
    {
      header: "Overdue month",
      width: 16,
      cell: (row) => dateCell(row.overdue_month),
    },
    {
      header: "Balance",
      width: 14,
      cell: (row) => moneyCell(row.outstanding_balance),
    },
    {
      header: "Remarks",
      width: 30,
      cell: (row) => textCell(row.remarks || "-"),
    },
    {
      header: "Status",
      width: 12,
      cell: (row) =>
        textCell(row.is_active ? "Active" : "Inactive"),
    },
    {
      header: "Created",
      width: 16,
      cell: (row) => dateCell(row.created_at),
    },
  ];

  const headerRow = [
    {
      value: "S.No",
      type: String,
      fontWeight: "bold",
      backgroundColor: "#f1f5f9",
    },
    ...columns.map((column) => ({
      value: column.header,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#f1f5f9",
    })),
  ];

  const dataRows = customers.map((row, index) => [
    { value: index + 1, type: Number },
    ...columns.map((column) => column.cell(row)),
  ]);

  const { default: writeXlsxFile } = await import(
    "write-excel-file/browser"
  );

  await writeXlsxFile([headerRow, ...dataRows], {
    sheet: "All Customers",
    columns: [
      { width: 8 },
      ...columns.map((column) => ({
        width: column.width,
      })),
    ],
    stickyRowsCount: 1,
  }).toFile(fileName);

  return true;
}

function pdfText(value) {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}

function pdfMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * PDF version of the All Customers Excel export — same columns and values,
 * laid out as a readable table across landscape pages.
 */
export async function downloadCustomersPdf({
  customers,
  fileName,
}) {
  if (!customers.length) return false;

  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "landscape",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;

  // Same column set and order as downloadCustomersExcel.
  const columns = [
    {
      header: "S.No",
      weight: 6,
      cell: (row, index) => String(index + 1),
    },
    {
      header: "Customer",
      weight: 20,
      cell: (row) => pdfText(row.customer_name),
    },
    {
      header: "STB",
      weight: 15,
      cell: (row) => pdfText(row.stb_number),
    },
    {
      header: "Phone",
      weight: 13,
      cell: (row) => pdfText(row.phone),
    },
    {
      header: "Place",
      weight: 18,
      cell: (row) => pdfText(row.place),
    },
    {
      header: "Package",
      weight: 20,
      cell: (row) => pdfText(row.package_name),
    },
    {
      header: "Monthly amount",
      weight: 14,
      cell: (row) => pdfMoney(row.package_monthly_amount),
    },
    {
      header: "Assigned",
      weight: 18,
      cell: (row) =>
        pdfText(
          row.assigned_user_name || row.assigned_username
        ),
    },
    {
      header: "Overdue month",
      weight: 16,
      cell: (row) => pdfText(normalizeDate(row.overdue_month)),
    },
    {
      header: "Balance",
      weight: 13,
      cell: (row) => pdfMoney(row.outstanding_balance),
    },
    {
      header: "Remarks",
      weight: 22,
      cell: (row) => pdfText(row.remarks),
    },
    {
      header: "Status",
      weight: 12,
      cell: (row) =>
        row.is_active ? "Active" : "Inactive",
    },
    {
      header: "Created",
      weight: 16,
      cell: (row) => pdfText(normalizeDate(row.created_at)),
    },
  ];

  const totalWeight = columns.reduce(
    (sum, column) => sum + column.weight,
    0
  );
  const widths = columns.map(
    (column) => (usableWidth * column.weight) / totalWeight
  );

  const headerHeight = 8;
  const fontSize = 7.5;
  const lineHeight = 3.6;

  function drawHeader(y) {
    doc.setFillColor(241, 245, 249);
    doc.rect(
      margin,
      y,
      usableWidth,
      headerHeight,
      "F"
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(15, 23, 42);

    let x = margin;
    columns.forEach((column, index) => {
      doc.text(
        doc.splitTextToSize(
          column.header,
          widths[index] - 2
        ),
        x + 1,
        y + 4.5
      );
      x += widths[index];
    });

    doc.setDrawColor(203, 213, 225);
    doc.line(
      margin,
      y + headerHeight,
      margin + usableWidth,
      y + headerHeight
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("All Customers", margin, margin + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${customers.length} customers`,
    margin + usableWidth,
    margin + 1,
    { align: "right" }
  );

  let y = margin + 6;
  drawHeader(y);
  y += headerHeight;

  customers.forEach((row, index) => {
    doc.setFontSize(fontSize);

    const cellLines = columns.map((column, colIndex) =>
      doc.splitTextToSize(
        column.cell(row, index),
        widths[colIndex] - 2
      )
    );
    const rowHeight =
      Math.max(...cellLines.map((lines) => lines.length)) *
        lineHeight +
      2;

    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader(y);
      y += headerHeight;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usableWidth, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);

    let x = margin;
    cellLines.forEach((lines, colIndex) => {
      doc.text(lines, x + 1, y + 3.2);
      x += widths[colIndex];
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(
      margin,
      y + rowHeight,
      margin + usableWidth,
      y + rowHeight
    );

    y += rowHeight;
  });

  doc.save(fileName);
  return true;
}

function getUniqueStbNumbers(records) {
  const stbNumbers = new Set();

  for (const row of records) {
    const stbNumber = String(row.stb_number ?? "").trim();

    if (stbNumber) {
      stbNumbers.add(stbNumber);
    }
  }

  return [...stbNumbers];
}

export async function downloadStbPdf({ records, fileName }) {
  const stbNumbers = getUniqueStbNumbers(records);

  if (stbNumbers.length === 0) return false;

  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const lineHeight = 7;
  const text = stbNumbers.join(", ");
  const lines = doc.splitTextToSize(
    text,
    pageWidth - margin * 2
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  let y = margin + 5;

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin + 5;
    }

    doc.text(line, margin, y);
    y += lineHeight;
  }

  doc.save(fileName);

  return true;
}
