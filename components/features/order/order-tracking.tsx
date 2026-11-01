"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCustomerOrder, submitReview } from "@/actions/orders";
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { OrderStatus } from "@prisma/client";
import {
  CheckCircle2, Clock, ChefHat, Utensils, Star, Loader2,
  ShoppingBag, XCircle, RefreshCw, ArrowRight, Download,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface OrderTrackingProps {
  orderId: string;
  /** e.g. "table-3" — used to build the "Order More" link back to the menu */
  tableParam?: string;
  /** Primary brand color from restaurant settings */
  primaryColor?: string;
}

const STATUS_STEPS: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.PREPARING,
  OrderStatus.PREPARED,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.COMPLETED,
  OrderStatus.COLLECTED,
];

const STATUS_META: Record<
  string,
  { icon: React.ReactNode; label: string; desc: string; estimatedMin?: number }
> = {
  PLACED: {
    icon: <Clock className="size-5" />,
    label: "Order Placed",
    desc: "Your order has been received.",
    estimatedMin: 2,
  },
  PREPARING: {
    icon: <ChefHat className="size-5" />,
    label: "Preparing",
    desc: "Our chefs are cooking your meal.",
    estimatedMin: 5,
  },
  PREPARED: {
    icon: <ChefHat className="size-5" />,
    label: "Prepared",
    desc: "Your food is prepared and ready to serve.",
  },
  READY: {
    icon: <Utensils className="size-5" />,
    label: "Ready to Serve",
    desc: "Your food is ready! Waiter is on the way.",
  },
  SERVED: {
    icon: <Utensils className="size-5" />,
    label: "Served",
    desc: "Enjoy your meal! 😊",
  },
  COMPLETED: {
    icon: <CheckCircle2 className="size-5" />,
    label: "Completed",
    desc: "Thank you for dining with us!",
  },
  COLLECTED: {
    icon: <CheckCircle2 className="size-5" />,
    label: "Collected",
    desc: "Your takeaway order has been collected. Thank you!",
  },
  CANCELLED: {
    icon: <XCircle className="size-5" />,
    label: "Cancelled",
    desc: "This order has been cancelled.",
  },
};

export function OrderTrackingClient({
  orderId,
  tableParam,
  primaryColor: overrideColor,
}: OrderTrackingProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const { data: order, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getCustomerOrder(orderId),
    refetchInterval: 10000,
  });

  // Backup polling (handles cases where tab goes to background)
  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleReview = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setReviewLoading(true);
    const result = await submitReview({
      orderId,
      customerName: order!.customerName,
      rating,
      comment: comment || undefined,
    });
    setReviewLoading(false);
    if (result.error) toast.error(result.error);
    else {
      setReviewSubmitted(true);
      toast.success("Thank you for your review! ⭐");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <XCircle className="size-12 text-muted-foreground" />
        <p className="font-medium">Order not found</p>
        <p className="text-sm text-muted-foreground">
          The order ID may be invalid or the order has been removed.
        </p>
        <Link href="/">
          <Button variant="outline">Go Home</Button>
        </Link>
      </div>
    );
  }

  // Determine primary color: override → order's restaurant settings fallback
  const primaryColor = overrideColor ?? "#E11D48";

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isCompleted =
    order.status === OrderStatus.COMPLETED ||
    order.status === OrderStatus.COLLECTED;
  const isActive = !isCancelled && !isCompleted;

  // Estimated time remaining (rough based on status)
  const estimatedMinutes: Record<string, string> = {
    PLACED: "~20-25 min",
    PREPARING: "~15-20 min",
    PREPARED: "~5-10 min",
    READY: "Ready now!",
    SERVED: "Served",
    COMPLETED: "Done",
  };
  const eta = estimatedMinutes[order.status] ?? "";

  return (
    <div className="min-h-dvh bg-background pb-8">
      {/* ─── Header ─── */}
      <div className="border-b border-border/60 bg-background/95 px-4 py-5 text-center backdrop-blur-sm">
        <h1 className="text-xl font-bold">Order Tracking</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {order.table
            ? `Table ${order.table.number}`
            : `Takeaway #${order.orderNumber ?? orderId.slice(-8).toUpperCase()}`}
          {" · "}#{orderId.slice(-8).toUpperCase()}
        </p>
        {isActive && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-2 flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Refreshing..." : "Auto-refreshing every 10s"}
          </button>
        )}
      </div>

      <div className="mx-auto max-w-lg space-y-5 p-4">

        {/* ─── Live Status Banner ─── */}
        <div
          className="rounded-2xl p-5 text-white text-center"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center justify-center mb-2">
            {STATUS_META[order.status]?.icon ?? <Clock className="size-6" />}
          </div>
          <p className="text-lg font-bold">{getOrderStatusLabel(order.status)}</p>
          <p className="text-sm opacity-90 mt-0.5">
            {STATUS_META[order.status]?.desc ?? ""}
          </p>
          {isActive && eta && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
              <Clock className="size-3.5" />
              {eta}
            </div>
          )}
        </div>

        {/* ─── Status Timeline ─── */}
        {!isCancelled && (
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-0">
                {STATUS_STEPS.map((step, index) => {
                  const isComplete = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const meta = STATUS_META[step];
                  const isLast = index === STATUS_STEPS.length - 1;

                  return (
                    <div key={step} className="relative flex gap-4">
                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className={`absolute left-5 top-10 w-0.5 h-8 transition-colors ${
                            index < currentStepIndex ? "bg-primary" : "bg-border"
                          }`}
                          style={index < currentStepIndex ? { backgroundColor: primaryColor } : {}}
                        />
                      )}

                      {/* Step circle */}
                      <div
                        className={`relative z-10 mt-3 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                          isComplete
                            ? "text-white"
                            : "bg-muted text-muted-foreground"
                        } ${isCurrent && isActive ? "animate-pulse" : ""}`}
                        style={isComplete ? { backgroundColor: primaryColor } : {}}
                      >
                        {meta?.icon ?? <Clock className="size-5" />}
                      </div>

                      {/* Step label */}
                      <div className="flex-1 pb-8 pt-3">
                        <p
                          className={`text-sm font-medium ${
                            isCurrent
                              ? "text-foreground"
                              : isComplete
                              ? "text-foreground/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          {meta?.label ?? getOrderStatusLabel(step)}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-muted-foreground mt-0.5 animate-pulse">
                            {meta?.desc}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Cancelled state ─── */}
        {isCancelled && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="flex items-center gap-3 pt-4">
              <XCircle className="size-6 text-red-600 shrink-0" />
              <div>
                <p className="font-medium text-red-700">Order Cancelled</p>
                <p className="text-xs text-muted-foreground">
                  Please contact the staff for assistance.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Order Summary ─── */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Order Summary</CardTitle>
              <Badge className={getOrderStatusColor(order.status)} variant="secondary">
                {getOrderStatusLabel(order.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.orderItems.map((item) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const customizations = item.customizations as any;
              return (
                <div key={item.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {item.quantity}× {item.menuItem.name}
                    </span>
                    <span className="font-medium">{formatCurrency(Number(item.price) * item.quantity)}</span>
                  </div>
                  {/* Variant & addons from customizations */}
                  {customizations?.variant && (
                    <p className="text-xs text-muted-foreground ml-4">{customizations.variant.name}</p>
                  )}
                  {customizations?.addons?.length > 0 && (
                    <p className="text-xs text-muted-foreground ml-4">
                      + {customizations.addons.map((a: { name: string }) => a.name).join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-muted-foreground ml-4 italic">Note: {item.notes}</p>
                  )}
                </div>
              );
            })}

            {/* Bill breakdown */}
            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST</span>
                <span>{formatCurrency(order.gstAmount)}</span>
              </div>
              {Number(order.serviceChargeAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span>{formatCurrency(order.serviceChargeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Grand Total</span>
                <span style={{ color: primaryColor }}>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Placed {formatDate(order.createdAt)}
              </p>
              <Badge variant={order.paymentStatus === "SUCCESS" ? "default" : "outline"}>
                {order.paymentStatus === "SUCCESS" ? "✓ Paid" : "Payment Pending"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ─── Download Bill ─── */}
        {isCompleted && (
          <Button
            variant="outline"
            className="w-full h-11 gap-2"
            onClick={() =>
              window.open(
                `/api/bills/${orderId}${tableParam ? `?table=${encodeURIComponent(tableParam)}` : ""}`,
                "_blank"
              )
            }
          >
            <Download className="size-4" />
            Download Bill
          </Button>
        )}

        {/* ─── Order More ─── */}
        {tableParam && (
          <Link href={`/menu/${tableParam}`}>
            <Button
              variant="outline"
              className="w-full h-11 gap-2 border-primary/50 hover:border-primary"
            >
              <ShoppingBag className="size-4" />
              Order More Items
              <ArrowRight className="size-4 ml-auto" />
            </Button>
          </Link>
        )}

        {/* ─── Review ─── */}
          {isCompleted && !reviewSubmitted && (
            <div>
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="size-4 text-amber-500" />
                    Rate Your Experience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`size-9 transition-colors ${
                            star <= rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Tell us about your experience..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleReview}
                    disabled={reviewLoading}
                    className="w-full"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {reviewLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Submit Review
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

        {/* ─── Thank you banner after review ─── */}
        {reviewSubmitted && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
            <p className="text-2xl mb-1">🙏</p>
            <p className="font-semibold text-green-800">Thank you!</p>
            <p className="text-sm text-green-700 mt-0.5">
              Your feedback helps us improve.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
