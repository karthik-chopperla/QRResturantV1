"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Role } from "@prisma/client";
import {
  approvePurchaseOrder,
  createPurchaseOrder,
  getPurchasingData,
  receivePurchase,
  recordSupplierPayment,
  saveSupplier,
  setSupplierActive,
} from "@/actions/purchasing";
import { getCurrentUser } from "@/actions/auth";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useEffect } from "react";

type PurchaseData = Awaited<ReturnType<typeof getPurchasingData>>;
type Ingredient = Extract<PurchaseData, { ingredients: unknown }>["ingredients"][number];

export default function PurchasingPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["purchasing-data"],
    queryFn: getPurchasingData,
    refetchInterval: 15000,
  });
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [supplier, setSupplier] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
  });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { ingredientId: "", quantity: "", unitCost: "" },
  ]);
  const suppliers = data && "suppliers" in data ? data.suppliers ?? [] : [];
  const ingredients = data && "ingredients" in data ? data.ingredients ?? [] : [];
  const purchaseOrders =
    data && "purchaseOrders" in data ? data.purchaseOrders ?? [] : [];

  useEffect(() => {
    void getCurrentUser().then((user) => setUserRole(user?.role ?? null));
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["purchasing-data"] });

  const handleSupplier = async () => {
    const result = await saveSupplier({
      ...supplier,
      ...(editingSupplierId ? { id: editingSupplierId } : {}),
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Supplier saved");
      setEditingSupplierId(null);
      setSupplier({ name: "", contactName: "", phone: "", email: "", address: "" });
      await refresh();
    }
  };

  const handleSupplierActive = async (id: string, isActive: boolean) => {
    const result = await setSupplierActive(id, isActive);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(isActive ? "Supplier reactivated" : "Supplier deactivated");
      await refresh();
    }
  };

  const handleCreatePO = async () => {
    const items = lines
      .filter((line) => line.ingredientId && Number(line.quantity) > 0)
      .map((line) => ({
        ingredientId: line.ingredientId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
      }));
    const result = await createPurchaseOrder({ supplierId, notes, items });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(`Purchase ${result.purchaseNumber} submitted for approval`);
      setLines([{ ingredientId: "", quantity: "", unitCost: "" }]);
      setNotes("");
      await refresh();
    }
  };

  const handleApprove = async (id: string) => {
    const result = await approvePurchaseOrder(id);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Purchase approved");
      await refresh();
    }
  };

  const handleReceive = async (
    purchase: NonNullable<typeof purchaseOrders>[number]
  ) => {
    const outstandingItems = purchase.items
      .map((item) => ({
        item,
        remaining: Number(item.orderedQuantity) - Number(item.receivedQuantity),
      }))
      .filter(({ remaining }) => remaining > 0);
    if (outstandingItems.length === 0) {
      toast.error("There are no remaining quantities to receive.");
      return;
    }
    const received: { purchaseOrderItemId: string; quantity: number }[] = [];
    for (const { item, remaining } of outstandingItems) {
      const quantity = window.prompt(
        `Quantity received for ${item.ingredient.name} (remaining ${remaining} ${item.ingredient.unit})`,
        String(remaining),
      );
      if (quantity === null) return;
      const parsedQuantity = Number(quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > remaining) {
        toast.error(`Enter a quantity greater than 0 and no more than ${remaining}.`);
        return;
      }
      received.push({ purchaseOrderItemId: item.id, quantity: parsedQuantity });
    }
    if (!window.confirm("Confirm these quantities were physically received? This updates inventory.")) return;
    const result = await receivePurchase({
      purchaseOrderId: purchase.id,
      idempotencyKey: crypto.randomUUID(),
      items: received,
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Received quantities added to inventory");
      await refresh();
    }
  };

  const handleSupplierPayment = async (purchaseOrderId: string) => {
    const rawAmount = window.prompt("Enter the supplier payment amount");
    if (!rawAmount) return;
    const amount = Number(rawAmount);
    const result = await recordSupplierPayment({
      purchaseOrderId,
      amount,
      method: "CASH",
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Supplier payment recorded");
      await refresh();
    }
  };

  return (
    <main>
      <StaffHeader title="Purchasing" subtitle="Suppliers, purchase orders, receiving, and supplier payments" role="PURCHASE_MANAGER" />
      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Suppliers" value={suppliers.length} />
          <Stat label="Purchase orders" value={purchaseOrders.length} />
          <Stat label="Awaiting approval or receipt" value={purchaseOrders.filter((item) => ["SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED"].includes(item.status)).length} />
        </section>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-lg font-semibold">{editingSupplierId ? "Edit Supplier" : "Add Supplier"}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input aria-label="Supplier name" placeholder="Supplier name" value={supplier.name} onChange={(event) => setSupplier({ ...supplier, name: event.target.value })} />
              <Input aria-label="Contact name" placeholder="Contact name" value={supplier.contactName} onChange={(event) => setSupplier({ ...supplier, contactName: event.target.value })} />
              <Input aria-label="Supplier phone" placeholder="Phone" value={supplier.phone} onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })} />
              <Input aria-label="Supplier email" placeholder="Email" type="email" value={supplier.email} onChange={(event) => setSupplier({ ...supplier, email: event.target.value })} />
              <Input aria-label="Supplier address" placeholder="Address" value={supplier.address} onChange={(event) => setSupplier({ ...supplier, address: event.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleSupplier()} disabled={!supplier.name.trim()}>{editingSupplierId ? "Update supplier" : "Save supplier"}</Button>
              {editingSupplierId && <Button variant="outline" onClick={() => {
                setEditingSupplierId(null);
                setSupplier({ name: "", contactName: "", phone: "", email: "", address: "" });
              }}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-lg font-semibold">Supplier Directory</h2>
            {suppliers.length === 0 ? <p className="text-sm text-muted-foreground">No suppliers recorded.</p> : suppliers.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{item.name} {!item.isActive && <Badge variant="secondary">Inactive</Badge>}</p>
                  <p className="text-sm text-muted-foreground">{[item.contactName, item.phone, item.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingSupplierId(item.id);
                    setSupplier({
                      name: item.name,
                      contactName: item.contactName ?? "",
                      phone: item.phone ?? "",
                      email: item.email ?? "",
                      address: item.address ?? "",
                    });
                  }}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => void handleSupplierActive(item.id, !item.isActive)}>
                    {item.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-lg font-semibold">Create Purchase Order</h2>
              <p className="text-sm text-muted-foreground">Submitting a purchase order does not add stock. The Owner must approve before receiving.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Supplier</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                  <option value="">Select supplier</option>
                  {suppliers.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <Input aria-label="Purchase notes" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={line.ingredientId} onChange={(event) => {
                  const ingredient = ingredients.find((item) => item.id === event.target.value) as Ingredient | undefined;
                  setLines((current) => current.map((entry, i) => i === index ? { ...entry, ingredientId: event.target.value, unitCost: ingredient ? String(ingredient.unitCost) : "" } : entry));
                }}>
                  <option value="">Select ingredient</option>
                  {ingredients.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
                </select>
                <Input aria-label="Order quantity" type="number" min="0.001" step="0.001" placeholder="Quantity" value={line.quantity} onChange={(event) => setLines((current) => current.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} />
                <Input aria-label="Unit cost" type="number" min="0" step="0.01" placeholder="Unit cost" value={line.unitCost} onChange={(event) => setLines((current) => current.map((entry, i) => i === index ? { ...entry, unitCost: event.target.value } : entry))} />
                <Button variant="outline" onClick={() => setLines((current) => current.length === 1 ? current : current.filter((_, i) => i !== index))}>Remove</Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setLines((current) => [...current, { ingredientId: "", quantity: "", unitCost: "" }])}>Add line</Button>
              <Button onClick={() => void handleCreatePO()} disabled={!supplierId || lines.every((line) => !line.ingredientId)}>Submit purchase order</Button>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Purchase History</h2>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading purchases…</p> : purchaseOrders.length === 0 ? <p className="text-sm text-muted-foreground">No purchases recorded.</p> : purchaseOrders.map((purchase) => {
            const paid = purchase.supplierPayments.reduce((sum, item) => sum + Number(item.amount), 0);
            return (
              <Card key={purchase.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><strong>{purchase.purchaseNumber}</strong><Badge variant="secondary">{purchase.status}</Badge></div>
                      <p className="text-sm text-muted-foreground">{purchase.supplier.name} · {formatDate(purchase.createdAt)}</p>
                      <p className="text-sm">{purchase.items.map((item) => `${item.ingredient.name}: ${Number(item.receivedQuantity)}/${Number(item.orderedQuantity)} ${item.ingredient.unit}`).join(" · ")}</p>
                      {purchase.receipts.length > 0 && <p className="text-xs text-muted-foreground">Receipts: {purchase.receipts.map((receipt) => formatDate(receipt.receivedAt)).join(", ")}</p>}
                      <p className="text-sm">Total {formatCurrency(purchase.totalAmount)} · Paid {formatCurrency(paid)} · Outstanding {formatCurrency(Math.max(0, Number(purchase.totalAmount) - paid))}</p>
                      {purchase.supplierPayments.length > 0 && <p className="text-xs text-muted-foreground">Payments: {purchase.supplierPayments.map((payment) => `${formatDate(payment.paidAt)} ${formatCurrency(payment.amount)} (${payment.method})`).join(" · ")}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {purchase.status === "SUBMITTED" && userRole === Role.RESTAURANT_OWNER && <Button size="sm" onClick={() => void handleApprove(purchase.id)}>Approve</Button>}
                      {["APPROVED", "PARTIALLY_RECEIVED"].includes(purchase.status) && <Button size="sm" onClick={() => void handleReceive(purchase)}>Receive remaining</Button>}
                      {purchase.status !== "CANCELLED" && Number(purchase.totalAmount) > paid && <Button size="sm" variant="outline" onClick={() => void handleSupplierPayment(purchase.id)}>Record supplier payment</Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>;
}
