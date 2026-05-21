import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number | string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showSign?: boolean;
}

export function CurrencyDisplay({ 
  amount, 
  className, 
  size = "md",
  showSign = false 
}: CurrencyDisplayProps) {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  const isNegative = numAmount < 0;
  const formatted = formatCurrency(Math.abs(numAmount));
  
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
    xl: "text-2xl font-semibold",
  };

  return (
    <span 
      className={cn(
        "font-mono tabular-nums",
        sizeClasses[size],
        isNegative && "text-destructive",
        className
      )}
      data-testid="currency-display"
    >
      {showSign && !isNegative && "+"}
      {isNegative && "-"}
      {formatted}
    </span>
  );
}
