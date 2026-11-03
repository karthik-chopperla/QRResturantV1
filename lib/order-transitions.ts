import { OrderStatus, OrderType } from "@prisma/client";

export function getNextOrderStatuses(
  status: OrderStatus,
  orderType: OrderType
): OrderStatus[] {
  switch (status) {
    case OrderStatus.PLACED:
    case OrderStatus.CONFIRMED:
      return [OrderStatus.PREPARING];
    case OrderStatus.PREPARING:
      return [OrderStatus.PREPARED];
    case OrderStatus.PREPARED:
      return [OrderStatus.READY];
    case OrderStatus.READY:
      return [
        orderType === OrderType.DINE_IN
          ? OrderStatus.SERVED
          : OrderStatus.COLLECTED,
      ];
    default:
      return [];
  }
}
