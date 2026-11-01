"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import {
  closeCashRegister,
  createTakeawayOrder,
  getCashierData,
  openCashRegister,
} from "@/actions/cashier";
import { updateOrderPaymentStatus } from "@/actions/orders";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, getOrderStatusLabel } from "@/lib/format";
import { toNumber } from "@/lib/decimal";
import { toast } from "sonner";
import { Minus, Plus, Printer, Search, Trash2 } from "lucide-react";

type CashierData = Extract<
  Awaited<ReturnType<typeof getCashierData>>,
  { menuItems: unknown }
>;
type MenuItem = CashierData["menuItems"][number];

type CartLine = {
  key: string;
  menuItem: MenuItem;
  quantity: number;
  variantId: string | null;
  addonIds: string[];
  notes: string;
};

export default function CashierPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["cashier-data"],
    queryFn: getCashierData,
    refetchInterval: 10000,
  });
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [couponCode, setCouponCode] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");

  const menuItems = useMemo(
    () => (data && !("error" in data) ? (data.menuItems as MenuItem[]) : []),
    [data]
  );
  const categories =
    data && !("error" in data) ? data.categories : [];
  const orders = data && !("error" in data) ? data.orders : [];
  const settings = data && !("error" in data) ? data.settings : null;
  const openRegister = data && !("error" in data) ? data.openRegister : null;

  const filteredItems = useMemo(
    () =>
      menuItems.filter((item) => {
        const matchesSearch =
          !search ||
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          (item.description ?? "").toLowerCase().includes(search.toLowerCase());
        return matchesSearch && (categoryId === "all" || item.categoryId === categoryId);
      }),
    [menuItems, search, categoryId]
  );

  const subtotal = cart.reduce((total, line) => {
    const variant = line.menuItem.variants.find((item) => item.id === line.variantId);
    const basePrice = variant
      ? toNumber(variant.price)
      : toNumber(line.menuItem.discountPrice) || toNumber(line.menuItem.price);
    const addonsPrice = line.addonIds.reduce((sum, id) => {
      const addon = line.menuItem.addons.find((item) => item.id === id);
      return sum + (addon ? toNumber(addon.price) : 0);
    }, 0);
    return total + (basePrice + addonsPrice) * line.quantity;
  }, 0);
  const estimatedGst = (subtotal * (settings?.gstPercentage ?? 0)) / 100;
  const estimatedServiceCharge =
    (subtotal * (settings?.serviceChargePercentage ?? 0)) / 100;
  const total = subtotal + estimatedGst + estimatedServiceCharge;

  const addToCart = (line: CartLine) => {
    setCart((current) => [...current, line]);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + delta } : line
        )
        .filter((line) => line.quantity > 0)
    );
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error("Add at least one menu item.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createTakeawayOrder({
        customerName,
        customerPhone,
        paymentMethod,
        couponCode: couponCode || undefined,
        notes: orderNotes || undefined,
        items: cart.map((line) => ({
          menuItemId: line.menuItem.id,
          quantity: line.quantity,
          notes: line.notes || undefined,
          customizations: {
            variant: line.variantId
              ? (() => {
                  const variant = line.menuItem.variants.find(
                    (item) => item.id === line.variantId
                  );
                  return variant
                    ? {
                        id: variant.id,
                        name: variant.name,
                        price: toNumber(variant.price),
                      }
                    : null;
                })()
              : null,
            addons: line.addonIds.map((id) => {
              const addon = line.menuItem.addons.find((item) => item.id === id);
              return {
                id,
                name: addon?.name,
                price: addon ? toNumber(addon.price) : 0,
              };
            }),
          },
        })),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Takeaway #${result.orderNumber} sent to Kitchen`);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCouponCode("");
      setOrderNotes("");
      await queryClient.invalidateQueries({ queryKey: ["cashier-data"] });
      window.open(`/api/bills/${result.orderId}`, "_blank", "noopener,noreferrer");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPayment = async (id: string) => {
    const result = await updateOrderPaymentStatus(id, PaymentStatus.SUCCESS);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Payment recorded as collected by cashier");
      await queryClient.invalidateQueries({ queryKey: ["cashier-data"] });
    }
  };

  const handleOpenRegister = async () => {
    const amount = Number(openingBalance);
    const result = await openCashRegister(amount);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Cash register opened");
      setOpeningBalance("");
      await queryClient.invalidateQueries({ queryKey: ["cashier-data"] });
    }
  };

  const handleCloseRegister = async () => {
    const amount = Number(closingBalance);
    const result = await closeCashRegister(amount);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(`Register closed. Expected cash: ${formatCurrency(result.expectedBalance)}`);
      setClosingBalance("");
      await queryClient.invalidateQueries({ queryKey: ["cashier-data"] });
    }
  };

  return (
    <main>
      <StaffHeader title="Cashier POS" subtitle="QR order billing and counter takeaway" role="CASHIER" />
      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-52 flex-1">
              <p className="font-medium">Cash Register</p>
              <p className="text-sm text-muted-foreground">
                {openRegister ? `Opened ${formatDate(openRegister.openedAt)}` : "No register session is open"}
              </p>
            </div>
            {openRegister ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="closing-balance">Counted cash at close</Label>
                  <Input
                    id="closing-balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={closingBalance}
                    onChange={(event) => setClosingBalance(event.target.value)}
                  />
                </div>
                <Button onClick={() => void handleCloseRegister()} disabled={!closingBalance}>
                  Close register
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="opening-balance">Opening cash</Label>
                  <Input
                    id="opening-balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingBalance}
                    onChange={(event) => setOpeningBalance(event.target.value)}
                  />
                </div>
                <Button onClick={() => void handleOpenRegister()} disabled={!openingBalance}>
                  Open register
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.8fr)]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search menu"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                aria-label="Filter menu category"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading menu…</p>
            ) : filteredItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No available menu items.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} onAdd={addToCart} />
                ))}
              </div>
            )}
          </div>

          <Card className="xl:sticky xl:top-4">
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="text-lg font-semibold">Counter Takeaway</h2>
                <p className="text-sm text-muted-foreground">
                  Counter orders are always takeaway; no dining table is assigned.
                </p>
              </div>
              <div className="space-y-2">
                {cart.length === 0 ? (
                  <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Add menu items to start an order.
                  </p>
                ) : cart.map((line) => (
                  <div key={line.key} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{line.menuItem.name}</p>
                      {line.variantId && <p className="text-xs text-muted-foreground">{line.menuItem.variants.find((v) => v.id === line.variantId)?.name}</p>}
                      {line.addonIds.length > 0 && <p className="text-xs text-muted-foreground">{line.addonIds.map((id) => line.menuItem.addons.find((a) => a.id === id)?.name).filter(Boolean).join(", ")}</p>}
                      <Input
                        className="mt-2 h-8"
                        placeholder="Item note"
                        maxLength={500}
                        value={line.notes}
                        onChange={(event) =>
                          setCart((current) =>
                            current.map((entry) =>
                              entry.key === line.key
                                ? { ...entry, notes: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => updateQuantity(line.key, -1)} aria-label="Decrease quantity"><Minus className="size-3" /></Button>
                      <span className="w-6 text-center text-sm">{line.quantity}</span>
                      <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => updateQuantity(line.key, 1)} aria-label="Increase quantity"><Plus className="size-3" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setCart((current) => current.filter((entry) => entry.key !== line.key))} aria-label="Remove item"><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Customer name (optional)" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                <Input placeholder="Mobile number (optional)" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              </div>
              <Input placeholder="Order notes (optional)" value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} />
              <div className="space-y-1">
                <Label htmlFor="cashier-coupon">Offer code (optional)</Label>
                <Input id="cashier-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["CASH", "UPI", "CARD"] as const).map((method) => (
                  <Button key={method} type="button" variant={paymentMethod === method ? "default" : "outline"} onClick={() => setPaymentMethod(method)}>
                    {method}
                  </Button>
                ))}
              </div>
              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span>GST estimate</span><span>{formatCurrency(estimatedGst)}</span></div>
                <div className="flex justify-between"><span>Service charge estimate</span><span>{formatCurrency(estimatedServiceCharge)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total before offer</span><span>{formatCurrency(total)}</span></div>
                <p className="text-xs text-muted-foreground">The server validates prices, discounts, GST, and service charges at order creation.</p>
              </div>
              <Button className="w-full" onClick={() => void submitOrder()} disabled={submitting || cart.length === 0}>
                {submitting ? "Creating order…" : "Create takeaway & send to kitchen"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Active Orders and QR Bills</h2>
            <p className="text-sm text-muted-foreground">
              Dine-in orders must originate from the customer’s table QR. This screen does not create dine-in orders.
            </p>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders to show.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{order.customerName}</strong>
                        <Badge variant="outline">
                          {order.table ? `Dine-in · Table ${order.table.number}` : `Takeaway #${order.orderNumber ?? order.id.slice(-8)}`}
                        </Badge>
                        <Badge variant="secondary">{getOrderStatusLabel(order.status)}</Badge>
                        <Badge variant={order.paymentStatus === PaymentStatus.SUCCESS ? "default" : "outline"}>
                          {order.paymentStatus} · {order.paymentMethod}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)} · {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/api/bills/${order.id}`, "_blank", "noopener,noreferrer")}>
                        <Printer className="mr-2 size-4" />Bill
                      </Button>
                      {order.paymentStatus === PaymentStatus.PENDING && order.paymentMethod !== PaymentMethod.RAZORPAY && (
                        <Button type="button" size="sm" onClick={() => void confirmPayment(order.id)}>
                          Confirm collected
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MenuItemCard({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: (line: CartLine) => void;
}) {
  const [variantId, setVariantId] = useState("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("1");

  const toggleAddon = (id: string) =>
    setAddonIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const basePrice = item.variants.length > 0
    ? toNumber(item.variants.find((variant) => variant.id === variantId)?.price ?? item.price)
    : toNumber(item.discountPrice) || toNumber(item.price);
  const addonTotal = addonIds.reduce((sum, id) => {
    const addon = item.addons.find((entry) => entry.id === id);
    return sum + (addon ? toNumber(addon.price) : 0);
  }, 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium">{item.name}</h3>
            <p className="text-xs text-muted-foreground">{item.category.name}</p>
          </div>
          <strong>{formatCurrency(basePrice + addonTotal)}</strong>
        </div>
        {item.variants.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor={`variant-${item.id}`}>Variant</Label>
            <select id={`variant-${item.id}`} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={variantId} onChange={(event) => setVariantId(event.target.value)}>
              <option value="">Default</option>
              {item.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} · {formatCurrency(variant.price)}
                </option>
              ))}
            </select>
          </div>
        )}
        {item.addons.length > 0 && (
          <div className="space-y-1">
            <Label>Add-ons</Label>
            {item.addons.map((addon) => (
              <label key={addon.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={addonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)} />
                  {addon.name}
                </span>
                <span className="text-muted-foreground">{formatCurrency(addon.price)}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input aria-label={`Quantity for ${item.name}`} type="number" min="1" max="99" className="w-20" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              const count = Number(quantity);
              if (!Number.isInteger(count) || count < 1 || count > 99) {
                toast.error("Quantity must be between 1 and 99.");
                return;
              }
              onAdd({
                key: crypto.randomUUID(),
                menuItem: item,
                quantity: count,
                variantId: variantId || null,
                addonIds,
                notes: "",
              });
              setQuantity("1");
            }}
          >
            Add to order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
