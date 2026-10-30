function toNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

export function formatCurrency(amount: unknown, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNum(amount));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PLACED: "Order Placed",
    CONFIRMED: "Confirmed",
    PREPARING: "Preparing",
    PREPARED: "Prepared",
    READY: "Ready to Serve",
    SERVED: "Served",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status;
}

export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PLACED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    CONFIRMED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    PREPARING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    PREPARED: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    READY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    SERVED: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}
