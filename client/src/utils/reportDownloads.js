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
