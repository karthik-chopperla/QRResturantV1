import type {
  AdminUser,
  Table,
  Category,
  MenuItem,
  Variant,
  Addon,
  Order,
  OrderItem,
  Payment,
  Offer,
  Review,
  Notification,
  Invoice,
  Settings,
  Role,
  TableStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  NotificationType,
  DiscountType,
} from "@prisma/client";

export type {
  AdminUser,
  Table,
  Category,
  MenuItem,
  Variant,
  Addon,
  Order,
  OrderItem,
  Payment,
  Offer,
  Review,
  Notification,
  Invoice,
  Settings,
  Role,
  TableStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  NotificationType,
  DiscountType,
};

export type TableWithOrders = Table & {
  orders: Order[];
};

export type MenuItemWithRelations = MenuItem & {
  category: Category;
  variants: Variant[];
  addons: Addon[];
  reviews?: Review[];
};

export type CategoryWithItems = Category & {
  menuItems: MenuItemWithRelations[];
  parentId?: string | null;
  children?: CategoryWithItems[];
};

export type OrderWithRelations = Order & {
  table: Table;
  orderItems: (OrderItem & { menuItem: MenuItem })[];
  payments: Payment[];
  reviews?: Review[];
  invoices?: Invoice[];
};

export type CartItem = {
  id: string;
  menuItemId: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  notes?: string;
  isVeg: boolean;
  customizations?: {
    variant?: { id: string; name: string; price: number } | null;
    addons?: { id: string; name: string; price: number }[];
  } | null;
};

export type OfferValidationResult = {
  isValid: boolean;
  message?: string;
  offer?: {
    code: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount: number;
  };
  discountAmount?: number;
};

export type DashboardStats = {
  todayOrders: number;
  pendingOrders: number;
  completedToday: number;
  todayRevenue: number;
  totalTables: number;
  occupiedTables: number;
  topItems: { item: MenuItem | undefined; quantity: number }[];
  chartData: { date: string; revenue: number }[];
  totalRevenue: number;
  avgOrderValue: number;
};

export type PublicMenuData = {
  restaurant: Settings;
  table: Table;
  categories: CategoryWithItems[];
  bestsellers: MenuItemWithRelations[];
  newItems: MenuItemWithRelations[];
  reviews: (Review & { menuItem: MenuItem | null })[];
};

export type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
};

export type CreateOrderResult = {
  success: true;
  orderId: string;
  totalAmount: number;
  razorpayOrder: RazorpayOrderResponse | null;
} | {
  error: string;
};

export type ActionResponse<T = undefined> = {
  success: true;
  data?: T;
} | {
  error: string;
};
