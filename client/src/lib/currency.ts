export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "0.000 BD";
  }
  
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return "0.000 BD";
  }
  
  const formatted = numAmount.toFixed(3);
  return `${formatted} BD`;
}

export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatNumber(value: number | string | null | undefined, decimals: number = 3): string {
  if (value === null || value === undefined) {
    return "0".padEnd(decimals + 2, "0");
  }
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return "0".padEnd(decimals + 2, "0");
  }
  
  return numValue.toFixed(decimals);
}
