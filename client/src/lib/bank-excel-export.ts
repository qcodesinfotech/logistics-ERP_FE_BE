import ExcelJS from "exceljs";
import type { BankAccount, BankTransaction } from "@shared/schema";

const PALETTE = {
  navyHeader: "1F4E78",
  slateHeader: "203764",
  tableHeader: "2C3E50",
  depositGreen: "1E8449",
  withdrawalRed: "C0392B",
  chargesAmber: "D35400",
  lightGrey: "F8F9FA",
  borderLight: "D9D9D9",
  borderMedium: "8FAADC",
  summaryBg: "EBF5FB",
  white: "FFFFFF",
  textDark: "1A1A1A",
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: `FF${PALETTE.borderLight}` } },
  left: { style: "thin", color: { argb: `FF${PALETTE.borderLight}` } },
  bottom: { style: "thin", color: { argb: `FF${PALETTE.borderLight}` } },
  right: { style: "thin", color: { argb: `FF${PALETTE.borderLight}` } },
};

function formatBHD(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

function formatDate(val: any): string {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toISOString().split("T")[0];
  } catch {
    return String(val);
  }
}

/**
 * Export Individual Bank Account Statement (Excel)
 */
export async function exportBankAccountStatementExcel(
  account: BankAccount,
  transactions: BankTransaction[],
  companyName: string = "Globe Link Logistics"
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Logistics ERP";
  wb.created = new Date();

  const safeSheetName = (account.name || "Account").replace(/[\\/*?:[\]]/g, "_").slice(0, 30);
  const ws = wb.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }],
  });

  // Calculate totals
  const openingBalance = formatBHD(account.openingBalance);
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalBankCharges = 0;

  // Sort transactions chronologically (oldest first for running balance)
  const sortedTxs = [...transactions].sort(
    (a, b) => new Date(a.transactionDate!).getTime() - new Date(b.transactionDate!).getTime()
  );

  sortedTxs.forEach((t) => {
    const amt = formatBHD(t.amount);
    const charges = formatBHD((t as any).bankCharges);
    if (t.type === "deposit") {
      totalDeposits += amt;
    } else {
      totalWithdrawals += amt;
      totalBankCharges += charges;
    }
  });

  const netEffect = totalDeposits - totalWithdrawals - totalBankCharges;
  const calculatedClosing = openingBalance + netEffect;
  const recordedClosing = formatBHD(account.currentBalance);

  // 1. Company & Document Header
  ws.mergeCells("A1:J1");
  const titleCell = ws.getCell("A1");
  titleCell.value = companyName.toUpperCase();
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells("A2:J2");
  const subCell = ws.getCell("A2");
  subCell.value = `BANK ACCOUNT TRANSACTION STATEMENT - ${account.name?.toUpperCase()}`;
  subCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF555555" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  ws.mergeCells("A3:J3");
  const dateCell = ws.getCell("A3");
  dateCell.value = `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Total Entries: ${sortedTxs.length}`;
  dateCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF777777" } };
  dateCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 18;

  // 2. Account Details & Balance Card (Rows 5 to 7)
  ws.mergeCells("A5:B5");
  ws.getCell("A5").value = "Bank Name:";
  ws.getCell("A5").font = { bold: true, size: 10 };
  ws.mergeCells("C5:E5");
  ws.getCell("C5").value = account.bankName || "N/A";

  ws.mergeCells("A6:B6");
  ws.getCell("A6").value = "Account Number:";
  ws.getCell("A6").font = { bold: true, size: 10 };
  ws.mergeCells("C6:E6");
  ws.getCell("C6").value = account.accountNumber || "N/A";

  ws.mergeCells("A7:B7");
  ws.getCell("A7").value = "Account Status:";
  ws.getCell("A7").font = { bold: true, size: 10 };
  ws.mergeCells("C7:E7");
  ws.getCell("C7").value = (account.status || "active").toUpperCase();

  // Financial summary block on right
  ws.getCell("G5").value = "Opening Balance:";
  ws.getCell("G5").font = { bold: true, size: 10 };
  ws.getCell("H5").value = openingBalance;
  ws.getCell("H5").numFmt = "#,##0.000";
  ws.getCell("H5").font = { bold: true, size: 10 };

  ws.getCell("G6").value = "Total Deposits (+):";
  ws.getCell("G6").font = { bold: true, size: 10, color: { argb: `FF${PALETTE.depositGreen}` } };
  ws.getCell("H6").value = totalDeposits;
  ws.getCell("H6").numFmt = "#,##0.000";
  ws.getCell("H6").font = { bold: true, size: 10, color: { argb: `FF${PALETTE.depositGreen}` } };

  ws.getCell("G7").value = "Total Withdrawals (-):";
  ws.getCell("G7").font = { bold: true, size: 10, color: { argb: `FF${PALETTE.withdrawalRed}` } };
  ws.getCell("H7").value = totalWithdrawals;
  ws.getCell("H7").numFmt = "#,##0.000";
  ws.getCell("H7").font = { bold: true, size: 10, color: { argb: `FF${PALETTE.withdrawalRed}` } };

  ws.getCell("I5").value = "Bank Charges (-):";
  ws.getCell("I5").font = { bold: true, size: 10, color: { argb: `FF${PALETTE.chargesAmber}` } };
  ws.getCell("J5").value = totalBankCharges;
  ws.getCell("J5").numFmt = "#,##0.000";
  ws.getCell("J5").font = { bold: true, size: 10, color: { argb: `FF${PALETTE.chargesAmber}` } };

  ws.getCell("I6").value = "Net Cash Flow:";
  ws.getCell("I6").font = { bold: true, size: 10 };
  ws.getCell("J6").value = netEffect;
  ws.getCell("J6").numFmt = "#,##0.000";
  ws.getCell("J6").font = { bold: true, size: 10 };

  ws.getCell("I7").value = "Current Balance:";
  ws.getCell("I7").font = { bold: true, size: 10, color: { argb: `FF${PALETTE.navyHeader}` } };
  ws.getCell("J7").value = recordedClosing !== 0 ? recordedClosing : calculatedClosing;
  ws.getCell("J7").numFmt = "#,##0.000";
  ws.getCell("J7").font = { bold: true, size: 11, color: { argb: `FF${PALETTE.navyHeader}` } };

  // 3. Transactions Table Header
  const headerRow = 9;
  const headers = [
    { header: "S.No", key: "sn", width: 6 },
    { header: "Date", key: "date", width: 13 },
    { header: "Type", key: "type", width: 14 },
    { header: "Reference / Cheque #", key: "ref", width: 22 },
    { header: "Description / Particulars", key: "desc", width: 34 },
    { header: "Deposit (BHD)", key: "deposit", width: 16 },
    { header: "Withdrawal (BHD)", key: "withdrawal", width: 16 },
    { header: "Bank Charges (BHD)", key: "charges", width: 18 },
    { header: "Total Effect (BHD)", key: "effect", width: 18 },
    { header: "Running Balance (BHD)", key: "balance", width: 22 },
  ];

  ws.getRow(headerRow).values = headers.map((h) => h.header);
  ws.getRow(headerRow).height = 26;

  for (let c = 1; c <= headers.length; c++) {
    const cell = ws.getRow(headerRow).getCell(c);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.navyHeader}` } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c === 1 || c === 2 || c === 3 ? "center" : c >= 6 ? "right" : "left",
    };
  }

  // 4. Data Rows
  let currentRow = headerRow + 1;
  let runningBal = openingBalance;

  sortedTxs.forEach((t, idx) => {
    const amt = formatBHD(t.amount);
    const charges = formatBHD((t as any).bankCharges);
    const isDeposit = t.type === "deposit";
    const depositAmt = isDeposit ? amt : 0;
    const withdrawalAmt = !isDeposit ? amt : 0;
    const totalEffect = isDeposit ? amt : -(amt + charges);
    runningBal += totalEffect;

    const row = ws.getRow(currentRow);
    row.values = [
      idx + 1,
      formatDate(t.transactionDate),
      t.type ? t.type.toUpperCase() : "TRANSACTION",
      t.reference || "-",
      t.description || "-",
      depositAmt > 0 ? depositAmt : null,
      withdrawalAmt > 0 ? withdrawalAmt : null,
      charges > 0 ? charges : null,
      totalEffect,
      runningBal,
    ];
    row.height = 20;

    // Formatting cells
    for (let c = 1; c <= headers.length; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: "Calibri", size: 10 };

      if (currentRow % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.lightGrey}` } };
      }

      if (c === 1 || c === 2) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (c === 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: isDeposit ? `FF${PALETTE.depositGreen}` : `FF${PALETTE.withdrawalRed}` },
        };
      } else if (c >= 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0.000";
        if (c === 6 && depositAmt > 0) {
          cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.depositGreen}` } };
        } else if (c === 7 && withdrawalAmt > 0) {
          cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.withdrawalRed}` } };
        } else if (c === 8 && charges > 0) {
          cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.chargesAmber}` } };
        } else if (c === 10) {
          cell.font = { name: "Calibri", size: 10, bold: true };
        }
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    }
    currentRow++;
  });

  // 5. Total Row
  const totalRow = ws.getRow(currentRow);
  totalRow.values = [
    "",
    "TOTAL",
    "",
    "",
    `Entries: ${sortedTxs.length}`,
    totalDeposits,
    totalWithdrawals,
    totalBankCharges,
    netEffect,
    runningBal,
  ];
  totalRow.height = 24;

  for (let c = 1; c <= headers.length; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
    cell.border = {
      top: { style: "medium", color: { argb: `FF${PALETTE.navyHeader}` } },
      bottom: { style: "double", color: { argb: `FF${PALETTE.navyHeader}` } },
    };
    if (c >= 6) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = "#,##0.000";
    } else {
      cell.alignment = { vertical: "middle", horizontal: c === 2 ? "center" : "left" };
    }
  }

  // Set column widths
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width;
  });

  // Generate buffer and trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const cleanAccountName = (account.name || "Bank_Account").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Bank_Statement_${cleanAccountName}_${new Date().toISOString().split("T")[0]}.xlsx`;

  downloadBlob(blob, filename);
}

/**
 * Export Collective Bank Statement for ALL Accounts (Excel)
 */
export async function exportCollectiveBankStatementExcel(
  accounts: BankAccount[],
  transactions: BankTransaction[],
  companyName: string = "Globe Link Logistics"
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Logistics ERP";
  wb.created = new Date();

  const accountMap = new Map<string, BankAccount>(accounts.map((a) => [a.id, a]));

  // ----------------------------------------------------
  // SHEET 1: ACCOUNTS SUMMARY
  // ----------------------------------------------------
  const wsSummary = wb.addWorksheet("Accounts Summary", {
    views: [{ showGridLines: true }],
  });

  wsSummary.mergeCells("A1:I1");
  const sTitle = wsSummary.getCell("A1");
  sTitle.value = companyName.toUpperCase();
  sTitle.font = { name: "Calibri", size: 14, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
  sTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(1).height = 24;

  wsSummary.mergeCells("A2:I2");
  const sSub = wsSummary.getCell("A2");
  sSub.value = "COLLECTIVE BANK ACCOUNTS SUMMARY & VERIFICATION REPORT";
  sSub.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF555555" } };
  sSub.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(2).height = 20;

  wsSummary.mergeCells("A3:I3");
  const sDate = wsSummary.getCell("A3");
  sDate.value = `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Total Accounts: ${accounts.length}`;
  sDate.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF777777" } };
  sDate.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(3).height = 18;

  const sumHeaders = [
    { header: "S.No", width: 6 },
    { header: "Account Name", width: 34 },
    { header: "Bank Name", width: 20 },
    { header: "Account Number", width: 20 },
    { header: "Opening Balance (BHD)", width: 22 },
    { header: "Total Deposits (BHD)", width: 22 },
    { header: "Total Withdrawals (BHD)", width: 22 },
    { header: "Bank Charges (BHD)", width: 20 },
    { header: "Current Balance (BHD)", width: 22 },
  ];

  const sumHeaderRow = 5;
  wsSummary.getRow(sumHeaderRow).values = sumHeaders.map((h) => h.header);
  wsSummary.getRow(sumHeaderRow).height = 26;

  for (let c = 1; c <= sumHeaders.length; c++) {
    const cell = wsSummary.getRow(sumHeaderRow).getCell(c);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.navyHeader}` } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c === 1 ? "center" : c >= 5 ? "right" : "left",
    };
  }

  let grandOpening = 0;
  let grandDeposits = 0;
  let grandWithdrawals = 0;
  let grandCharges = 0;
  let grandClosing = 0;

  let sRowIdx = sumHeaderRow + 1;
  accounts.forEach((acc, idx) => {
    const accTxs = transactions.filter((t) => t.bankAccountId === acc.id);
    const opening = formatBHD(acc.openingBalance);
    let dep = 0;
    let wdr = 0;
    let chg = 0;

    accTxs.forEach((t) => {
      const a = formatBHD(t.amount);
      const c = formatBHD((t as any).bankCharges);
      if (t.type === "deposit") dep += a;
      else {
        wdr += a;
        chg += c;
      }
    });

    const recordedCur = formatBHD(acc.currentBalance);
    const calculatedCur = opening + dep - wdr - chg;
    const finalCur = recordedCur !== 0 ? recordedCur : calculatedCur;

    grandOpening += opening;
    grandDeposits += dep;
    grandWithdrawals += wdr;
    grandCharges += chg;
    grandClosing += finalCur;

    const row = wsSummary.getRow(sRowIdx);
    row.values = [
      idx + 1,
      acc.name,
      acc.bankName || "-",
      acc.accountNumber || "-",
      opening,
      dep,
      wdr,
      chg,
      finalCur,
    ];
    row.height = 20;

    for (let c = 1; c <= sumHeaders.length; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: "Calibri", size: 10 };
      if (sRowIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.lightGrey}` } };
      }
      if (c === 1) cell.alignment = { vertical: "middle", horizontal: "center" };
      else if (c >= 5) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0.000";
        if (c === 5) cell.font = { name: "Calibri", size: 10 };
        else if (c === 6) cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.depositGreen}` } };
        else if (c === 7) cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.withdrawalRed}` } };
        else if (c === 8) cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.chargesAmber}` } };
        else if (c === 9) cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    }
    sRowIdx++;
  });

  // Grand Total Row
  const grandRow = wsSummary.getRow(sRowIdx);
  grandRow.values = [
    "",
    "TOTAL",
    "",
    `Accounts: ${accounts.length}`,
    grandOpening,
    grandDeposits,
    grandWithdrawals,
    grandCharges,
    grandClosing,
  ];
  grandRow.height = 24;

  for (let c = 1; c <= sumHeaders.length; c++) {
    const cell = grandRow.getCell(c);
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
    cell.border = {
      top: { style: "medium", color: { argb: `FF${PALETTE.navyHeader}` } },
      bottom: { style: "double", color: { argb: `FF${PALETTE.navyHeader}` } },
    };
    if (c >= 5) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = "#,##0.000";
    } else {
      cell.alignment = { vertical: "middle", horizontal: c === 2 ? "center" : "left" };
    }
  }

  sumHeaders.forEach((h, i) => {
    wsSummary.getColumn(i + 1).width = h.width;
  });

  // ----------------------------------------------------
  // SHEET 2: ALL TRANSACTIONS (COLLECTIVE)
  // ----------------------------------------------------
  const wsTx = wb.addWorksheet("All Transactions", {
    views: [{ showGridLines: true }],
  });

  wsTx.mergeCells("A1:L1");
  const txTitle = wsTx.getCell("A1");
  txTitle.value = companyName.toUpperCase();
  txTitle.font = { name: "Calibri", size: 14, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
  txTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsTx.getRow(1).height = 24;

  wsTx.mergeCells("A2:L2");
  const txSub = wsTx.getCell("A2");
  txSub.value = "COLLECTIVE BANK TRANSACTIONS LOG";
  txSub.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF555555" } };
  txSub.alignment = { horizontal: "center", vertical: "middle" };
  wsTx.getRow(2).height = 20;

  const txHeaders = [
    { header: "S.No", width: 6 },
    { header: "Date", width: 13 },
    { header: "Account Name", width: 30 },
    { header: "Bank", width: 16 },
    { header: "Account #", width: 18 },
    { header: "Type", width: 14 },
    { header: "Reference", width: 20 },
    { header: "Description / Particulars", width: 32 },
    { header: "Deposit (BHD)", width: 16 },
    { header: "Withdrawal (BHD)", width: 16 },
    { header: "Bank Charges (BHD)", width: 18 },
    { header: "Total Effect (BHD)", width: 18 },
  ];

  const txHeaderRow = 4;
  wsTx.getRow(txHeaderRow).values = txHeaders.map((h) => h.header);
  wsTx.getRow(txHeaderRow).height = 26;

  for (let c = 1; c <= txHeaders.length; c++) {
    const cell = wsTx.getRow(txHeaderRow).getCell(c);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.navyHeader}` } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c === 1 || c === 2 || c === 6 ? "center" : c >= 9 ? "right" : "left",
    };
  }

  // Sort chronological
  const sortedAllTxs = [...transactions].sort(
    (a, b) => new Date(a.transactionDate!).getTime() - new Date(b.transactionDate!).getTime()
  );

  let txRowIdx = txHeaderRow + 1;
  let allDep = 0;
  let allWdr = 0;
  let allChg = 0;
  let allNet = 0;

  sortedAllTxs.forEach((t, idx) => {
    const acc = accountMap.get(t.bankAccountId);
    const amt = formatBHD(t.amount);
    const charges = formatBHD((t as any).bankCharges);
    const isDeposit = t.type === "deposit";
    const depAmt = isDeposit ? amt : 0;
    const wdrAmt = !isDeposit ? amt : 0;
    const effect = isDeposit ? amt : -(amt + charges);

    allDep += depAmt;
    allWdr += wdrAmt;
    allChg += charges;
    allNet += effect;

    const row = wsTx.getRow(txRowIdx);
    row.values = [
      idx + 1,
      formatDate(t.transactionDate),
      acc?.name || "Unknown Account",
      acc?.bankName || "-",
      acc?.accountNumber || "-",
      t.type ? t.type.toUpperCase() : "TRANSACTION",
      t.reference || "-",
      t.description || "-",
      depAmt > 0 ? depAmt : null,
      wdrAmt > 0 ? wdrAmt : null,
      charges > 0 ? charges : null,
      effect,
    ];
    row.height = 20;

    for (let c = 1; c <= txHeaders.length; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: "Calibri", size: 10 };
      if (txRowIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.lightGrey}` } };
      }
      if (c === 1 || c === 2) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (c === 6) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: isDeposit ? `FF${PALETTE.depositGreen}` : `FF${PALETTE.withdrawalRed}` },
        };
      } else if (c >= 9) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0.000";
        if (c === 9 && depAmt > 0) cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.depositGreen}` } };
        else if (c === 10 && wdrAmt > 0) cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.withdrawalRed}` } };
        else if (c === 11 && charges > 0) cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.chargesAmber}` } };
        else if (c === 12) cell.font = { name: "Calibri", size: 10, bold: true };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    }
    txRowIdx++;
  });

  // Total row for All Transactions
  const allTxTotal = wsTx.getRow(txRowIdx);
  allTxTotal.values = [
    "",
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    `Entries: ${sortedAllTxs.length}`,
    allDep,
    allWdr,
    allChg,
    allNet,
  ];
  allTxTotal.height = 24;

  for (let c = 1; c <= txHeaders.length; c++) {
    const cell = allTxTotal.getCell(c);
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
    cell.border = {
      top: { style: "medium", color: { argb: `FF${PALETTE.navyHeader}` } },
      bottom: { style: "double", color: { argb: `FF${PALETTE.navyHeader}` } },
    };
    if (c >= 9) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = "#,##0.000";
    } else {
      cell.alignment = { vertical: "middle", horizontal: c === 2 ? "center" : "left" };
    }
  }

  txHeaders.forEach((h, i) => {
    wsTx.getColumn(i + 1).width = h.width;
  });

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `Collective_Bank_Transactions_Report_${new Date().toISOString().split("T")[0]}.xlsx`;

  downloadBlob(blob, filename);
}

/**
 * Export Individual or Collective Bank Transactions to CSV
 */
export function exportBankTransactionsCSV(
  transactions: BankTransaction[],
  account?: BankAccount | null,
  filenamePrefix: string = "Bank_Transactions"
) {
  if (!transactions) return;

  const headers = [
    "S.No",
    "Date",
    ...(account ? [] : ["Account Name", "Bank Name", "Account Number"]),
    "Type",
    "Reference",
    "Description",
    "Deposit (BHD)",
    "Withdrawal (BHD)",
    "Bank Charges (BHD)",
    "Total Effect (BHD)",
  ];

  const rows = transactions.map((t, idx) => {
    const amt = formatBHD(t.amount);
    const charges = formatBHD((t as any).bankCharges);
    const isDeposit = t.type === "deposit";
    const depAmt = isDeposit ? amt.toFixed(3) : "0.000";
    const wdrAmt = !isDeposit ? amt.toFixed(3) : "0.000";
    const totalEffect = (isDeposit ? amt : -(amt + charges)).toFixed(3);

    const values = [
      idx + 1,
      formatDate(t.transactionDate),
      ...(account ? [] : [`"${(t as any).accountName || ""}"`, `"${(t as any).bankName || ""}"`, `"${(t as any).accountNumber || ""}"`]),
      t.type ? t.type.toUpperCase() : "TRANSACTION",
      `"${(t.reference || "").replace(/"/g, '""')}"`,
      `"${(t.description || "").replace(/"/g, '""')}"`,
      depAmt,
      wdrAmt,
      charges.toFixed(3),
      totalEffect,
    ];
    return values.join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `${filenamePrefix}_${new Date().toISOString().split("T")[0]}.csv`;
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
