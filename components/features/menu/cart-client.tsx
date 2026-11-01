"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/hooks/use-cart";
import { createOrder, cancelUnpaidOrder } from "@/actions/orders";
import { validateOffer } from "@/actions/offers";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import {
  ArrowLeft, Minus, Plus, Trash2, Loader2, CreditCard,
  Banknote, Tag, StickyNote, ChevronRight, ShoppingBag,
} from "lucide-react";

interface Props {
  tableParam: string;
  gstPercentage: number;
  serviceChargePercentage: number;
  primaryColor: string;
  restaurantName: string;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** FSSAI-style food type indicator */
function VegIndicator({ foodType }: { foodType: "VEG" | "NON_VEG" | "VEGAN" }) {
  if (foodType === "VEGAN") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold leading-none text-emerald-700">
        🌱 Vegan
      </span>
    );
  }
  return (
    <span
      className={`inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border-2 ${
        foodType === "VEG" ? "border-green-600" : "border-red-600"
      }`}
    >
      <span className={`size-1.5 rounded-full ${foodType === "VEG" ? "bg-green-600" : "bg-red-600"}`} />
    </span>
  );
}

export function CartClient({
  tableParam,
  gstPercentage,
  serviceChargePercentage,
  primaryColor,
  restaurantName,
}: Props) {
  const router = useRouter();
  const {
    items,
    tableId,
    tableNumber,
    notes,
    coupon,
    updateQuantity,
    removeItem,
    setNotes,
    applyCoupon,
    removeCoupon,
    clearCart,
    getSubtotal,
    getDiscountAmount,
    getGstAmount,
    getServiceChargeAmount,
    getTotalAmount,
  } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "RAZORPAY">(
    PaymentMethod.CASH
  );
  const [loading, setLoading] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);

  // Redirect to menu if cart empties (but not during active order submission)
  const isSubmitting = useRef(false);
  useEffect(() => {
    if (items.length === 0 && !isSubmitting.current) {
      router.replace(`/menu/${tableParam}`);
    }
  }, [items, router, tableParam]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const result = await validateOffer(couponCode, getSubtotal());
    setCouponLoading(false);
    if (!result.isValid) {
      toast.error(result.message || "Invalid offer");
      return;
    }
    applyCoupon(result.offer!);
    setCouponCode("");
    toast.success(`Offer ${result.offer!.code} applied! 🎉`);
  };

  const handleCheckout = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    isSubmitting.current = true;
    setLoading(true);

    const result = await createOrder({
      tableId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod,
      couponCode: coupon?.code || couponCode || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        customizations: item.customizations ?? undefined,
      })),
    });

    setLoading(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      isSubmitting.current = false;
      return;
    }

    if (!("success" in result) || !result.success) {
      isSubmitting.current = false;
      return;
    }

    if (paymentMethod === PaymentMethod.RAZORPAY && result.razorpayOrder) {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway");
        isSubmitting.current = false;
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        name: restaurantName,
        description: `Order at Table ${tableNumber}`,
        order_id: result.razorpayOrder.id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Verify payment on backend before marking as successful
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              console.error("Payment verification failed:", verifyData);
              toast.error(
                "Payment received but verification failed. Please contact support with your payment ID: " +
                  response.razorpay_payment_id
              );
              // Don't clear cart or redirect — order stays CONFIRMED, webhook may still fix it
              isSubmitting.current = false;
              return;
            }

            // Verification succeeded — safe to proceed
            clearCart();
            toast.success("Payment successful!");
            router.push(`/order/${result.orderId}`);
          } catch (err) {
            // Network error during verification — payment was made, webhook will handle it
            console.error("Verification network error:", err);
            toast.success("Payment received! Redirecting...");
            clearCart();
            router.push(`/order/${result.orderId}`);
          }
        },
        prefill: { name: customerName, contact: customerPhone },
        theme: { color: primaryColor },
        modal: {
          ondismiss: async () => {
            isSubmitting.current = false;
            await cancelUnpaidOrder(result.orderId, tableId);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      clearCart();
      toast.success("Order placed! Pay at the counter. 🍽️");
      router.push(`/order/${result.orderId}`);
    }
  };

  // Show empty state briefly while redirect fires
  if (items.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <ShoppingBag className="size-12 text-muted-foreground" />
        <p className="text-muted-foreground">Your cart is empty</p>
        <Link href={`/menu/${tableParam}`}>
          <Button style={{ backgroundColor: primaryColor }}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Menu
          </Button>
        </Link>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const discount = getDiscountAmount();
  const gst = getGstAmount(gstPercentage);
  const serviceCharge = getServiceChargeAmount(serviceChargePercentage);
  const total = getTotalAmount(gstPercentage, serviceChargePercentage);

  return (
    <div className="min-h-dvh bg-background pb-8">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur-md">
        <Link href={`/menu/${tableParam}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Your Cart</h1>
          <p className="text-xs text-muted-foreground">Table {tableNumber}</p>
        </div>
        <span
          className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <ShoppingBag className="size-3" />
          {items.reduce((s, i) => s + i.quantity, 0)}
        </span>
      </div>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        {/* ─── Cart Items ─── */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="overflow-hidden">
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    {item.image ? (
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                        <Image src={item.image} alt={item.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                        🍽️
                      </div>
                    )}

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <VegIndicator foodType={item.foodType} />
                        <p className="truncate font-medium text-sm">{item.name}</p>
                      </div>

                      {/* Variant */}
                      {item.customizations?.variant && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 mb-1">
                          {item.customizations.variant.name}
                        </Badge>
                      )}

                      {/* Add-ons */}
                      {item.customizations?.addons && item.customizations.addons.length > 0 && (
                        <div className="mb-1 flex flex-wrap gap-1">
                          {item.customizations.addons.map((a) => (
                            <Badge key={a.id} variant="outline" className="text-[10px] px-1.5 py-0">
                              + {a.name}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Item-level note */}
                      {item.notes && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
                          <StickyNote className="size-3 shrink-0" />
                          <span className="truncate">{item.notes}</span>
                        </div>
                      )}

                      {/* Price */}
                      <p className="mt-1 text-sm font-semibold" style={{ color: primaryColor }}>
                        {formatCurrency(
                          (item.price +
                            (item.customizations?.addons?.reduce((s, a) => s + a.price, 0) ?? 0)) *
                            item.quantity
                        )}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* ─── Offer / Coupon ─── */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="size-4" />
              Offers & Coupons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coupon ? (
              <div className="animate-in fade-in zoom-in-95 duration-200 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-green-700">
                    🎉 {coupon.code} applied
                  </p>
                  <p className="text-xs text-green-600">
                    Saving {formatCurrency(discount)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={removeCoupon}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter offer code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                />
                <Button variant="outline" onClick={handleApplyCoupon} disabled={couponLoading}>
                  {couponLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Customer Details ─── */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 9876543210"
                type="tel"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Special Instructions</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any allergies or special requests for the order..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── Payment Method ─── */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod(PaymentMethod.RAZORPAY)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                paymentMethod === PaymentMethod.RAZORPAY
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <CreditCard
                className="size-7"
                style={{ color: paymentMethod === PaymentMethod.RAZORPAY ? primaryColor : undefined }}
              />
              <span className="text-sm font-medium">Pay Online</span>
              <span className="text-xs text-muted-foreground">UPI, Cards</span>
            </button>
            <button
              onClick={() => setPaymentMethod(PaymentMethod.CASH)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                paymentMethod === PaymentMethod.CASH
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <Banknote
                className="size-7"
                style={{ color: paymentMethod === PaymentMethod.CASH ? primaryColor : undefined }}
              />
              <span className="text-sm font-medium">Pay at Counter</span>
              <span className="text-xs text-muted-foreground">Cash / Card</span>
            </button>
          </CardContent>
        </Card>

        {/* ─── Bill Summary ─── */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bill Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)
              </span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({coupon?.code})</span>
                <span>−{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST ({gstPercentage}%)</span>
              <span>{formatCurrency(gst)}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Charge</span>
                <span>{formatCurrency(serviceCharge)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Grand Total</span>
              <span style={{ color: primaryColor }}>{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* ─── Place Order Button ─── */}
        <Button
          className="h-12 w-full text-base font-semibold gap-2"
          style={{ backgroundColor: primaryColor }}
          onClick={handleCheckout}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ChevronRight className="size-5" />
          )}
          {paymentMethod === PaymentMethod.RAZORPAY ? "Pay & Place Order" : "Place Order"}
        </Button>

        <p className="text-center text-xs text-muted-foreground pb-2">
          By placing your order, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
