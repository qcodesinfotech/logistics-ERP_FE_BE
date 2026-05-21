import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "active" | "inactive" | "pending" | "completed" | "cancelled" | "paid" | "partial" | "credit" | "todo" | "in_progress" | "done" | "low" | "medium" | "high";

const statusConfig: Record<StatusType, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  inactive: { label: "Inactive", variant: "secondary" },
  pending: { label: "Pending", variant: "outline" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  paid: { label: "Paid", variant: "default" },
  partial: { label: "Partial", variant: "outline" },
  credit: { label: "Credit", variant: "secondary" },
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "secondary" },
  done: { label: "Done", variant: "default" },
  low: { label: "Low", variant: "outline" },
  medium: { label: "Medium", variant: "secondary" },
  high: { label: "High", variant: "destructive" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_") as StatusType;
  const config = statusConfig[normalizedStatus] || { label: status, variant: "outline" as const };

  return (
    <Badge 
      variant={config.variant} 
      className={cn("text-xs", className)}
      data-testid={`status-badge-${normalizedStatus}`}
    >
      {config.label}
    </Badge>
  );
}
