import ExcelJS from "exceljs";

// Helper color palette matching customer templates
const PALETTE = {
  navyHeader: "1F4E78",      // Deep Ocean / Navy blue for Activity & Main tables
  navyText: "1F4E78",
  slateHeader: "203764",     // Midnight Blue for Utilization
  tealHeader: "0E6655",      // Dark Teal for Outlet Master
  greenHeader: "1E8449",     // Forest Green for Fleet Master
  orangeHeader: "ED7D31",    // Vibrant Orange for Outbound Deviations
  kpiHeader: "D9E1F2",       // Soft Steel Blue for KPI Table
  legendNum: "002060",       // Blue for [1] [2] [3] [4]
  softGreen: "E2EFDA",       // Light Sage Green for Trip & Seq
  zebraOdd: "F8F9FA",        // Light subtle tint for alternating rows
  white: "FFFFFF",
  borderLight: "D9D9D9",     // Standard light grey gridlines
  borderMedium: "8FAADC",    // Medium borders
  peach: "FDEBD0",           // Dry/Chilled tag
  iceBlue: "D4E6F1",         // Frozen tag
  lightPink: "FADBD8",       // Packaging tag
  textDark: "1A1A1A",
};

// Reusable border style generator
function getThinBorder(colorArgb: string = PALETTE.borderLight): ExcelJS.Borders {
  return {
    top: { style: "thin", color: { argb: `FF${colorArgb}` } },
    left: { style: "thin", color: { argb: `FF${colorArgb}` } },
    bottom: { style: "thin", color: { argb: `FF${colorArgb}` } },
    right: { style: "thin", color: { argb: `FF${colorArgb}` } }
  };
}

export async function exportCustomerReportExcel(reportData: any) {
  if (!reportData) return;

  const activityRecords = reportData?.activityRecords || [];
  const utilizationRecords = reportData?.utilizationRecords || [];
  const weeklyKpis = reportData?.weeklyKpis || [];
  const deviations = reportData?.deviations || [];
  const masters = reportData?.masters || { outlets: [], vehicles: [] };

  const wb = new ExcelJS.Workbook();
  wb.creator = "Americana Logistics ERP";
  wb.created = new Date();

  // =========================================================================================
  // SHEET 1: ACTIVITY REPORT (Matching Screenshot 1)
  // =========================================================================================
  const wsAct = wb.addWorksheet("Activity_Report", {
    views: [{ showGridLines: true }]
  });

  // Define columns
  wsAct.columns = [
    { header: "Trip", key: "trip", width: 9 },
    { header: "Seq", key: "seq", width: 8 },
    { header: "Date", key: "date", width: 13 },
    { header: "Week", key: "week", width: 9 },
    { header: "Type", key: "storageType", width: 10 },
    { header: "TruckNo", key: "truckNo", width: 13 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "Location", key: "location", width: 32 },
    { header: "Vehicle Type", key: "vehicleType", width: 14 },
    { header: "No of Restaurants", key: "noOfRestaurants", width: 18 },
    { header: "Cases", key: "cases", width: 10 },
    { header: "ReportingTime [1]", key: "reportingTime", width: 18 },
    { header: "DepartTime [2]", key: "departTime", width: 18 },
    { header: "DropStartTime [3]", key: "dropStartTime", width: 18 },
    { header: "DropEndTime [4]", key: "dropEndTime", width: 18 },
    { header: "", key: "empty", width: 4 },
    { header: "", key: "legendKey", width: 6 },
    { header: "", key: "legendText", width: 30 },
  ];

  // Format Header Row (Row 1)
  const actHeaderRow = wsAct.getRow(1);
  actHeaderRow.height = 28;
  for (let c = 1; c <= 15; c++) {
    const cell = actHeaderRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.navyHeader}` }
    };
    cell.font = {
      name: "Calibri",
      size: 10.5,
      bold: true,
      color: { argb: `FF${PALETTE.white}` }
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true
    };
    cell.border = getThinBorder(PALETTE.borderMedium);
  }

  // Populate Activity Rows
  activityRecords.forEach((a: any, idx: number) => {
    const rowNum = idx + 2;
    const isOdd = idx % 2 === 1;
    const row = wsAct.getRow(rowNum);
    row.height = 20;

    row.values = [
      a.trip || "",
      a.seq || "",
      a.date || "",
      a.week || "",
      a.storageType || "",
      a.truckNo || "",
      a.brand || "",
      a.location || "",
      a.vehicleType || "",
      a.noOfRestaurants || 1,
      Number(a.cases || 0),
      a.reportingTime || "",
      a.departTime || "",
      a.dropStartTime || "",
      a.dropEndTime || ""
    ];

    // Style data cells
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.textDark}` } };
      cell.border = getThinBorder(PALETTE.borderLight);

      // Alignments
      if (c === 7 || c === 8) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      // Zebra background
      if (isOdd) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${PALETTE.zebraOdd}` }
        };
      }

      // Green highlight for Trip & Seq (matching Image 1)
      if (c === 1 || c === 2) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${PALETTE.softGreen}` }
        };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${PALETTE.textDark}` } };
      }

      // Storage type subtle tint
      if (c === 5) {
        const val = String(a.storageType || "").toUpperCase();
        if (val.includes("FRZ") || val.includes("FROZEN")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.iceBlue}` } };
        } else if (val.includes("CH") || val.includes("CHILLED")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.peach}` } };
        }
      }

      // Bold for cases
      if (c === 11) {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${PALETTE.textDark}` } };
      }
    }
  });

  // Add Timestamp Legend to Column Q & R (Image 1 Legend)
  const legendItems = [
    { code: "[1]", label: "Time Arrived at Warehouse" },
    { code: "[2]", label: "Time Left the Warehouse" },
    { code: "[3]", label: "Time Arrived at Restaurant" },
    { code: "[4]", label: "Time Left the Restaurant" }
  ];

  legendItems.forEach((item, i) => {
    const lRow = wsAct.getRow(i + 2);
    const codeCell = lRow.getCell(17);
    const labelCell = lRow.getCell(18);

    codeCell.value = item.code;
    codeCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: `FF${PALETTE.legendNum}` } };
    codeCell.alignment = { vertical: "middle", horizontal: "center" };

    labelCell.value = item.label;
    labelCell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF000000" } };
    labelCell.alignment = { vertical: "middle", horizontal: "left" };
  });

  // =========================================================================================
  // SHEET 2: TRUCK UTILIZATION & WEEKLY KPIS (Matching Screenshot 2)
  // =========================================================================================
  const wsUtil = wb.addWorksheet("Truck_Utilization", {
    views: [{ showGridLines: true }]
  });

  wsUtil.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Week", key: "week", width: 9 },
    { header: "Type", key: "type", width: 10 },
    { header: "TruckNo", key: "truckNo", width: 13 },
    { header: "No of Restaurants", key: "noOfRestaurants", width: 18 },
    { header: "Target Truck Capacity (CS)", key: "targetTruckCapacity", width: 25 },
    { header: "Actual Cases (CS)", key: "actualCases", width: 18 },
    { header: "TripStart", key: "tripStart", width: 14 },
    { header: "TripEnd", key: "tripEnd", width: 14 },
    { header: "Target Utilization (Hours)", key: "targetUtilization", width: 25 },
    { header: "Actual Utilization (Hours)", key: "actualUtilization", width: 25 },
    { header: "Utilization %", key: "utilizationPercent", width: 16 },
    { header: "Carton %", key: "cartonPercent", width: 16 },
    { header: "", key: "blank", width: 4 },
    // Columns O - U for Weekly KPI Matrix
    { header: "", key: "kpi", width: 16 },
    { header: "", key: "target", width: 12 },
    { header: "", key: "wk1", width: 10 },
    { header: "", key: "wk2", width: 10 },
    { header: "", key: "wk3", width: 10 },
    { header: "", key: "wk4", width: 10 },
    { header: "", key: "total", width: 12 },
  ];

  // Header 1: Main Utilization Table
  const utilHeaderRow = wsUtil.getRow(1);
  utilHeaderRow.height = 28;
  for (let c = 1; c <= 13; c++) {
    const cell = utilHeaderRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.slateHeader}` }
    };
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.white}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = getThinBorder(PALETTE.borderMedium);
  }

  // Populate Utilization Rows
  utilizationRecords.forEach((u: any, idx: number) => {
    const rowNum = idx + 2;
    const isOdd = idx % 2 === 1;
    const row = wsUtil.getRow(rowNum);
    row.height = 20;

    row.getCell(1).value = u.date || "";
    row.getCell(2).value = u.week || "";
    row.getCell(3).value = u.type || "FRZ";
    row.getCell(4).value = u.truckNo || "";
    row.getCell(5).value = u.noOfRestaurants || 1;
    row.getCell(6).value = Number(u.targetTruckCapacity || 320);
    row.getCell(7).value = Number(u.actualCases || 0);
    row.getCell(8).value = u.tripStart || "";
    row.getCell(9).value = u.tripEnd || "";
    row.getCell(10).value = Number(u.targetUtilization || 10).toFixed(2);
    row.getCell(11).value = Number(u.actualUtilization || 0).toFixed(2);
    row.getCell(12).value = `${u.utilizationPercent}%`;
    row.getCell(13).value = `${u.cartonPercent}%`;

    for (let c = 1; c <= 13; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.textDark}` } };
      cell.border = getThinBorder(PALETTE.borderLight);
      cell.alignment = { vertical: "middle", horizontal: "center" };

      if (isOdd) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${PALETTE.zebraOdd}` }
        };
      }

      // Format Utilization & Carton %
      if (c === 12 || c === 13) {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${PALETTE.navyText}` } };
      }
    }
  });

  // Weekly KPI Matrix (Columns O - U, Top Right of Image 2)
  const kpiHeaders = ["KPI", "Target", "wk1", "wk2", "wk3", "wk4", "Total"];
  const kpiHeaderRow = wsUtil.getRow(1);
  kpiHeaders.forEach((title, i) => {
    const colIdx = 15 + i;
    const cell = kpiHeaderRow.getCell(colIdx);
    cell.value = title;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.kpiHeader}` }
    };
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.navyHeader}` } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = getThinBorder(PALETTE.borderMedium);
  });

  weeklyKpis.forEach((k: any, i: number) => {
    const r = wsUtil.getRow(i + 2);
    const cells = [
      r.getCell(15), r.getCell(16), r.getCell(17),
      r.getCell(18), r.getCell(19), r.getCell(20), r.getCell(21)
    ];

    cells[0].value = k.kpi;
    cells[1].value = k.target;
    cells[2].value = k.wk1;
    cells[3].value = k.wk2;
    cells[4].value = k.wk3;
    cells[5].value = k.wk4;
    cells[6].value = k.total;

    cells.forEach((c, cIdx) => {
      c.font = { name: "Calibri", size: 10, bold: cIdx === 0, color: { argb: `FF${PALETTE.textDark}` } };
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = getThinBorder(PALETTE.borderLight);
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${PALETTE.white}` }
      };
    });
  });

  // =========================================================================================
  // SHEET 3: OUTBOUND DEVIATIONS (Matching Screenshot 3)
  // =========================================================================================
  const wsDev = wb.addWorksheet("Outbound_Deviations", {
    views: [{ showGridLines: true }]
  });

  wsDev.columns = [
    { header: "", key: "sn", width: 8 },
    { header: "", key: "orderDate", width: 14 },
    { header: "", key: "outlet", width: 26 },
    { header: "", key: "product", width: 34 },
    { header: "", key: "reason", width: 38 },
    { header: "", key: "qty", width: 10 },
    { header: "", key: "gdn", width: 14 },
    { header: "", key: "sku", width: 16 },
    { header: "", key: "completionDate", width: 16 },
  ];

  // Row 2: Section Title (Italic, bold, Image 3 style)
  const titleRow = wsDev.getRow(2);
  const titleCell = titleRow.getCell(1);
  titleCell.value = "Outbound Deviation Data";
  titleCell.font = { name: "Calibri", size: 13, bold: true, italic: true, color: { argb: `FF${PALETTE.navyHeader}` } };

  // Row 4: Orange Header Row
  const devHeaderRow = wsDev.getRow(4);
  devHeaderRow.height = 26;
  const devHeaders = ["SN", "Order Date", "Outlet", "Product", "Reason", "Qty", "GDN", "SKU", "Completion Date"];
  devHeaders.forEach((hdr, i) => {
    const cell = devHeaderRow.getCell(i + 1);
    cell.value = hdr;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.orangeHeader}` }
    };
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.white}` } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = getThinBorder(PALETTE.orangeHeader);
  });

  // Deviations data rows
  deviations.forEach((d: any, idx: number) => {
    const rNum = idx + 5;
    const isOdd = idx % 2 === 1;
    const row = wsDev.getRow(rNum);
    row.height = 20;

    row.values = [
      d.sn || idx + 1,
      d.orderDate || "",
      d.outlet || "",
      d.product || "",
      d.reason || "",
      Number(d.qty || 0),
      d.gdn || "",
      d.sku || "",
      d.completionDate || ""
    ];

    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.textDark}` } };
      cell.border = getThinBorder(PALETTE.borderLight);

      if (c === 3 || c === 4 || c === 5) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      if (isOdd) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFDF2E9" } // subtle peach/orange tint
        };
      }

      if (c === 6) {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFC0392B" } }; // red accent for deviation qty
      }
    }
  });

  // =========================================================================================
  // SHEET 4: MASTER DATA (Outlets, Fleet & Capacity Matrix - Image 2 Bottom)
  // =========================================================================================
  const wsMaster = wb.addWorksheet("Master_Data", {
    views: [{ showGridLines: true }]
  });

  wsMaster.columns = [
    // Outlet Master (Cols A - H)
    { header: "SN", key: "sn", width: 7 },
    { header: "Latitude", key: "lat", width: 12 },
    { header: "Longitude", key: "lng", width: 12 },
    { header: "Location", key: "loc", width: 28 },
    { header: "Delivered To", key: "deliveredTo", width: 32 },
    { header: "Restaurant Name (AMC)", key: "amcName", width: 26 },
    { header: "Fusion #", key: "fusionNo", width: 14 },
    { header: "BRAND", key: "brand", width: 12 },
    { header: "", key: "space1", width: 4 },
    // Capacity Specs (Cols J - L)
    { header: "Type", key: "capType", width: 12 },
    { header: "Target Capacity (CS)", key: "capTarget", width: 20 },
    { header: "Description", key: "capDesc", width: 28 },
    { header: "", key: "space2", width: 4 },
    // Fleet Master (Cols N - U)
    { header: "SL#", key: "fSl", width: 7 },
    { header: "Truck#", key: "fTruck", width: 12 },
    { header: "Make", key: "fMake", width: 15 },
    { header: "Year", key: "fYear", width: 10 },
    { header: "GVW", key: "fGvw", width: 12 },
    { header: "Net Payload", key: "fPayload", width: 14 },
    { header: "Box Measurement", key: "fBox", width: 18 },
    { header: "Capacity in Cartons", key: "fCap", width: 20 },
  ];

  // Header Row: Master Tables
  const masterHeaderRow = wsMaster.getRow(1);
  masterHeaderRow.height = 28;

  // 1. Outlet Master Headers (Teal - Col 1 to 8)
  for (let c = 1; c <= 8; c++) {
    const cell = masterHeaderRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.tealHeader}` }
    };
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.white}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = getThinBorder(PALETTE.tealHeader);
  }

  // 2. Capacity Reference Headers (Navy - Col 10 to 12)
  for (let c = 10; c <= 12; c++) {
    const cell = masterHeaderRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.slateHeader}` }
    };
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.white}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = getThinBorder(PALETTE.slateHeader);
  }

  // 3. Fleet Master Headers (Forest Green - Col 14 to 21)
  for (let c = 14; c <= 21; c++) {
    const cell = masterHeaderRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.greenHeader}` }
    };
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.white}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = getThinBorder(PALETTE.greenHeader);
  }

  // Populate Capacity Specs rows (Image 2 specs)
  const capacitySpecs = [
    { type: "DRY/CH", target: 220, desc: "DRY & CHILLED FOOD (ONLY)", fill: PALETTE.peach },
    { type: "FRZ", target: 320, desc: "FROZEN FOOD (ONLY)", fill: PALETTE.iceBlue },
    { type: "PKG", target: 200, desc: "NON-FOOD", fill: PALETTE.lightPink }
  ];

  capacitySpecs.forEach((spec, idx) => {
    const r = wsMaster.getRow(idx + 2);
    const cellType = r.getCell(10);
    const cellTarget = r.getCell(11);
    const cellDesc = r.getCell(12);

    cellType.value = spec.type;
    cellTarget.value = spec.target;
    cellDesc.value = spec.desc;

    [cellType, cellTarget, cellDesc].forEach((c, cIdx) => {
      c.font = { name: "Calibri", size: 10, bold: cIdx < 2, color: { argb: `FF${PALETTE.textDark}` } };
      c.alignment = { vertical: "middle", horizontal: cIdx === 2 ? "left" : "center" };
      c.border = getThinBorder(PALETTE.borderLight);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${spec.fill}` } };
    });
  });

  // Populate Outlets (Left Table)
  const outlets = masters.outlets || [];
  outlets.forEach((o: any, idx: number) => {
    const r = wsMaster.getRow(idx + 2);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = o.latitude || "";
    r.getCell(3).value = o.longitude || "";
    r.getCell(4).value = o.location || "";
    r.getCell(5).value = o.deliveredTo || "";
    r.getCell(6).value = o.amcName || "";
    r.getCell(7).value = o.fusionNo || "";
    r.getCell(8).value = o.brand || "";

    for (let c = 1; c <= 8; c++) {
      const cell = r.getCell(c);
      cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.textDark}` } };
      cell.border = getThinBorder(PALETTE.borderLight);
      if (c >= 4 && c <= 6) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    }
  });

  // Populate Fleet Vehicles (Right Table)
  const vehicles = masters.vehicles || [];
  vehicles.forEach((v: any, idx: number) => {
    const r = wsMaster.getRow(idx + 2);
    r.getCell(14).value = idx + 1;
    r.getCell(15).value = v.plateNumber || "";
    r.getCell(16).value = v.make || "";
    r.getCell(17).value = v.year || "2025";
    r.getCell(18).value = v.gvw || "7 TONS";
    r.getCell(19).value = v.netPayload || "4.5 TONS";
    r.getCell(20).value = v.boxMeasurement || "4.3x2x1.85";
    r.getCell(21).value = v.cartonCapacity || "260-280";

    for (let c = 14; c <= 21; c++) {
      const cell = r.getCell(c);
      cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.textDark}` } };
      cell.border = getThinBorder(PALETTE.borderLight);
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
  });

  // =========================================================================================
  // WRITE AND DOWNLOAD WORKBOOK
  // =========================================================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Americana_Activity_Utilization_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Styled export for Completed Deliveries on the Daily Dispatch board
 */
export async function exportCompletedDeliveriesExcel(deliveries: any[], filenamePrefix: string = "Completed_Deliveries") {
  if (!deliveries || !deliveries.length) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Americana Logistics ERP";
  wb.created = new Date();

  const ws = wb.addWorksheet("Completed_Deliveries", {
    views: [{ showGridLines: true }]
  });

  ws.columns = [
    { header: "SN", key: "sn", width: 7 },
    { header: "Date", key: "date", width: 13 },
    { header: "Type of Goods", key: "storageType", width: 14 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "Route", key: "route", width: 14 },
    { header: "Truck No", key: "truckNo", width: 14 },
    { header: "Outlet Code", key: "outletCode", width: 14 },
    { header: "Outlet Name", key: "outletName", width: 30 },
    { header: "TO / GDN", key: "toNo", width: 14 },
    { header: "Item Code", key: "itemCode", width: 14 },
    { header: "Description", key: "description", width: 30 },
    { header: "UOM", key: "uom", width: 8 },
    { header: "Req Qty", key: "requestedQty", width: 10 },
    { header: "Del Qty", key: "deliveredQty", width: 10 },
    { header: "Cases Handled", key: "cases", width: 14 },
    { header: "Reporting Time [1]", key: "reportingTime", width: 18 },
    { header: "Depart Time [2]", key: "departTime", width: 18 },
    { header: "Drop Start Time [3]", key: "dropStartTime", width: 18 },
    { header: "Drop End Time [4]", key: "dropEndTime", width: 18 },
    { header: "Driver", key: "driver", width: 18 },
    { header: "Status", key: "status", width: 12 },
  ];

  // Format Header Row
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  for (let c = 1; c <= 21; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${PALETTE.navyHeader}` }
    };
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: `FF${PALETTE.white}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = getThinBorder(PALETTE.borderMedium);
  }

  deliveries.forEach((d: any, idx: number) => {
    const rNum = idx + 2;
    const isOdd = idx % 2 === 1;
    const row = ws.getRow(rNum);
    row.height = 20;

    row.values = [
      d["SN"] ?? (idx + 1),
      d["Date"] || d.deliveredAt || d.sheetDate || "",
      d["Type of Goods"] || d.storageType || "Frozen",
      d["Brand"] || d.brandName || "General",
      d["Route"] || d.zoneName || "",
      d["Truck No"] || d.truckNo || "Unassigned",
      d["Outlet Code"] || d.outletCode || "",
      d["Outlet Name"] || d.outletName || d.customerName || "",
      d["TO / GDN"] || d.toNo || "-",
      d["Item Code"] || d.itemCode || "",
      d["Description"] || d.description || "",
      d["UOM"] || d.uom || "CT",
      Number(d["Requested Qty"] ?? d.requestedQty ?? 0),
      Number(d["Delivered Qty"] ?? d.deliveredQty ?? 0),
      Number(d["Cases Handled"] ?? d.deliveredQty ?? d.requestedQty ?? 0),
      d["Reporting Time [1]"] || d.reportingTime || "",
      d["Depart Time [2]"] || d.departTime || "",
      d["Drop Start Time [3]"] || d.deliveryStartTime || "",
      d["Drop End Time [4]"] || d.deliveryEndTime || "",
      d["Driver"] || d.driverName || "",
      d["Status"] || d.status || "Completed"
    ];

    for (let c = 1; c <= 21; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, color: { argb: `FF${PALETTE.textDark}` } };
      cell.border = getThinBorder(PALETTE.borderLight);

      if (c === 8 || c === 11) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      if (isOdd) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.zebraOdd}` } };
      }

      // Soft green highlight for SN
      if (c === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.softGreen}` } };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${PALETTE.textDark}` } };
      }

      // Storage type tag
      if (c === 3) {
        const val = String(d["Type of Goods"] || d.storageType || "").toUpperCase();
        if (val.includes("FRZ") || val.includes("FROZEN")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.iceBlue}` } };
        } else if (val.includes("CH") || val.includes("CHILLED")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALETTE.peach}` } };
        }
      }

      // Cases handled bold
      if (c === 15) {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${PALETTE.textDark}` } };
      }
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

