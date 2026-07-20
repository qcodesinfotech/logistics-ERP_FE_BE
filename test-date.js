const periodStart = "2026-07-13";
const periodEnd = "2026-07-20";
console.log(new Date(periodStart).toISOString());
console.log(new Date(periodEnd + 'T23:59:59').toISOString());
