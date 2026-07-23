const XLSX = require('xlsx');
const wb = XLSX.readFile('/Users/mohammed/Downloads/LogixERP-13JUL26/FROZEN ORDER FOR 25-07-2026.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rawJson = XLSX.utils.sheet_to_json(ws, { defval: "" });
const rawHeaders = Object.keys(rawJson[0]);
const normalize = (h) => {
  const lower = h.toLowerCase().replace(/\s+/g, "_");
  if (lower.includes("outlet") && lower.includes("code")) return "outlet_code";
  if (lower.includes("item") && lower.includes("code")) return "item_code";
  if (lower.includes("desc") && !lower.includes("sub_desc")) return "description";
  if (lower.includes("qty") && !lower.includes("fus")) return "weight";
  if (lower === "remaining") return "remaining";
  if (lower.includes("remark")) return "remark";
  if (lower.includes("grn")) return "grn_number";
  if (lower.includes("requested") && lower.includes("delivery") && lower.includes("date")) return "requested_delivery_date";
  return lower;
};
const headerMap = new Map();
rawHeaders.forEach(h => headerMap.set(h, normalize(h)));
const sheetParsed = rawJson.map(row => {
  const newRow = {};
  Object.entries(row).forEach(([key, val]) => {
    newRow[headerMap.get(key)] = String(val);
  });
  return newRow;
});
console.log(sheetParsed[0]);
