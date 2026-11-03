"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  exportAccountingCsv,
  getAccountingData,
  recordExpense,
  refundRazorpayPayment,
} from "@/actions/accounting";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

export default function AccountantPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(dateOnly(monthStart));
  const [to, setTo] = useState(dateOnly(today));
  const [expense, setExpense] = useState({
    description: "",
    category: "OTHER",
    amount: "",
    incurredAt: new Date().toISOString().slice(0, 16),
    reference: "",
    notes: "",
  });
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["accounting-data", from, to],
    queryFn: () => getAccountingData(from, to),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["accounting-data"] });
  };

  const submitExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await recordExpense({
      ...expense,
      amount: Number(expense.amount),
      incurredAt: new Date(expense.incurredAt).toISOString(),
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Expense recorded");
      setExpense({
        description: "",
        category: "OTHER",
        amount: "",
        incurredAt: new Date().toISOString().slice(0, 16),
        reference: "",
        notes: "",
      });
      await refresh();
    }
  };

  const handleRefund = async (orderId: string) => {
    const result = await refundRazorpayPayment({
      orderId,
      amount: Number(refundAmounts[orderId]),
      reason: refundReasons[orderId] ?? "",
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(result.message);
      await refetch();
    }
  };

  const downloadCsv = async () => {
    const result = await exportAccountingCsv(from, to);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([result.csv], { type: "text/csv" }));
    link.download = `dinedesk-financial-report-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const summary = data && "summary" in data ? data.summary : null;
  const transactions = data && "transactions" in data ? data.transactions ?? [] : [];
  const expenses = data && "expenses" in data ? data.expenses ?? [] : [];

  return (
    <main>
      <StaffHeader title="Accountant Dashboard" subtitle="Recorded collections, expenses, refunds, and summaries" role="ACCOUNTANT" />
      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1"><Label htmlFor="report-from">From</Label><Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="report-to">To</Label><Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
            <Button variant="outline" onClick={() => void refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button>
            <Button variant="outline" onClick={() => void downloadCsv()}><Download className="mr-2 size-4" />Export CSV</Button>
          </CardContent>
        </Card>

        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading financial records…</p> : data && "error" in data ? <p className="text-sm text-destructive">{data.error}</p> : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Gross recorded collections" value={formatCurrency(summary?.grossCollected ?? 0)} />
              <Stat label="Provider-confirmed refunds" value={formatCurrency(summary?.refundTotal ?? 0)} />
              <Stat label="Net revenue after refunds" value={formatCurrency(summary?.netRevenue ?? 0)} />
              <Stat label="Recorded expenses" value={formatCurrency(summary?.expenseTotal ?? 0)} />
              <Stat label="Supplier payments" value={formatCurrency(summary?.supplierPaymentTotal ?? 0)} />
              <Stat label="Estimated net after recorded outflows" value={formatCurrency(summary?.estimatedNet ?? 0)} />
              <Stat label="GST on paid orders" value={formatCurrency(summary?.gstCollected ?? 0)} />
              <Stat label="Service charges on paid orders" value={formatCurrency(summary?.serviceCharges ?? 0)} />
            </section>
            <Card>
              <CardContent className="space-y-2 p-4">
                <h2 className="text-lg font-semibold">Recorded collections by method</h2>
                <p className="text-xs text-muted-foreground">Refunds are shown separately above; payment totals include only SUCCESS records in this date range.</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary?.collections ?? {}).map(([method, amount]) => (
                    <Badge key={method} variant="secondary">{method}: {formatCurrency(amount)}</Badge>
                  ))}
                  {Object.keys(summary?.collections ?? {}).length === 0 && <p className="text-sm text-muted-foreground">No successful payments recorded for this period.</p>}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-4 text-lg font-semibold">Record Expense</h2>
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submitExpense}>
              <Input aria-label="Expense description" placeholder="Description" value={expense.description} onChange={(event) => setExpense({ ...expense, description: event.target.value })} required />
              <select aria-label="Expense category" className="h-10 rounded-md border bg-background px-3 text-sm" value={expense.category} onChange={(event) => setExpense({ ...expense, category: event.target.value })}>
                {["RENT", "ELECTRICITY", "WATER", "SALARIES", "MAINTENANCE", "MARKETING", "TRANSPORTATION", "SUPPLIES", "OTHER"].map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <Input aria-label="Expense amount" type="number" min="0.01" step="0.01" placeholder="Amount" value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} required />
              <Input aria-label="Expense date" type="datetime-local" value={expense.incurredAt} onChange={(event) => setExpense({ ...expense, incurredAt: event.target.value })} required />
              <Input aria-label="Expense reference" placeholder="Receipt/reference (optional)" value={expense.reference} onChange={(event) => setExpense({ ...expense, reference: event.target.value })} />
              <Input aria-label="Expense notes" placeholder="Notes (optional)" value={expense.notes} onChange={(event) => setExpense({ ...expense, notes: event.target.value })} />
              <Button className="sm:col-span-2" type="submit">Save expense</Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Payment Transactions</h2>
          {transactions.length === 0 ? <p className="text-sm text-muted-foreground">No payment transactions in this period.</p> : transactions.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{payment.order.orderNumber ?? payment.orderId.slice(-8)}</strong>
                    <Badge variant="outline">{payment.order.orderType}</Badge>
                    <Badge variant={payment.status === "SUCCESS" ? "default" : "secondary"}>{payment.status} · {payment.method}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{payment.order.customerName} · {formatDate(payment.createdAt)} · {formatCurrency(payment.amount)}</p>
                </div>
                {payment.method === "RAZORPAY" && payment.status === "SUCCESS" && (
                  <div className="flex flex-wrap gap-2">
                    <Input className="w-32" aria-label="Refund amount" type="number" min="0.01" step="0.01" placeholder="Refund amount" value={refundAmounts[payment.orderId] ?? ""} onChange={(event) => setRefundAmounts((current) => ({ ...current, [payment.orderId]: event.target.value }))} />
                    <Input className="w-48" aria-label="Refund reason" placeholder="Reason" value={refundReasons[payment.orderId] ?? ""} onChange={(event) => setRefundReasons((current) => ({ ...current, [payment.orderId]: event.target.value }))} />
                    <Button variant="outline" onClick={() => void handleRefund(payment.orderId)} disabled={!refundAmounts[payment.orderId] || !refundReasons[payment.orderId]}>Request refund</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recorded Expenses</h2>
          {expenses.length === 0 ? <p className="text-sm text-muted-foreground">No expenses in this period.</p> : expenses.map((item) => (
            <Card key={item.id}><CardContent className="flex flex-wrap justify-between gap-2 p-4"><span>{item.description} · {item.category} · {formatDate(item.incurredAt)}</span><strong>{formatCurrency(item.amount)}</strong></CardContent></Card>
          ))}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></CardContent></Card>;
}
