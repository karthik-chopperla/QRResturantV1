"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { MenuItemDialog } from "@/components/features/menu/menu-item-dialog";
import {
  Search, ShoppingBag, Bell, Receipt,
  Star, ChevronRight, Filter, Sparkles, Crown,
} from "lucide-react";
import { requestService } from "@/actions/orders";
import { toast } from "sonner";

interface MenuData {
  restaurant: {
    restaurantName: string;
    logo: string | null;
    banner: string | null;
    primaryColor: string;
  };
  table: {
    id: string;
    number: string;
  };
  bestsellers: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    discountPrice: number | null;
    foodType: "VEG" | "NON_VEG" | "VEGAN";
    spicyLevel: number;
    preparationTime: number;
    images: string[];
    ingredients: string[];
    allergens: string[];
    isChefSpecial?: boolean;
    variants: { id: string; name: string; price: number }[];
    addons: { id: string; name: string; price: number; isVeg: boolean }[];
    category: { id: string; name: string };
  }>;
  newItems: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    discountPrice: number | null;
    foodType: "VEG" | "NON_VEG" | "VEGAN";
    spicyLevel: number;
    preparationTime: number;
    images: string[];
    ingredients: string[];
    allergens: string[];
    isChefSpecial?: boolean;
    variants: { id: string; name: string; price: number }[];
    addons: { id: string; name: string; price: number; isVeg: boolean }[];
    category: { id: string; name: string };
  }>;
  reviews: Array<{
    id: string;
    customerName: string;
    rating: number;
    comment: string | null;
    createdAt: Date | string;
    menuItem: { name: string } | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    parentId: string | null;
    description: string | null;
    children?: Array<{
      id: string;
      name: string;
      parentId: string | null;
      description: string | null;
      menuItems: Array<{
        id: string;
        name: string;
        description: string | null;
        price: number;
        discountPrice: number | null;
        foodType: "VEG" | "NON_VEG" | "VEGAN";
        spicyLevel: number;
        preparationTime: number;
        images: string[];
        ingredients: string[];
        allergens: string[];
        isChefSpecial?: boolean;
        variants: { id: string; name: string; price: number }[];
        addons: { id: string; name: string; price: number; isVeg: boolean }[];
      }>;
    }>;
    menuItems: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      discountPrice: number | null;
      foodType: "VEG" | "NON_VEG" | "VEGAN";
      spicyLevel: number;
      preparationTime: number;
      images: string[];
      ingredients: string[];
      allergens: string[];
      isChefSpecial?: boolean;
      variants: { id: string; name: string; price: number }[];
      addons: { id: string; name: string; price: number; isVeg: boolean }[];
    }>;
  }>;
}

interface Props {
  data: MenuData;
  tableParam: string;
}

/** FSSAI-style food type indicator */
function FoodTypeIndicator({ foodType }: { foodType: "VEG" | "NON_VEG" | "VEGAN" }) {
  if (foodType === "VEGAN") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold leading-none text-emerald-700 dark:bg-emerald-950/40">
        🌱 Vegan
      </span>
    );
  }
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-2 ${
        foodType === "VEG" ? "border-green-600" : "border-red-600"
      }`}
    >
      <span
        className={`size-2 rounded-full ${foodType === "VEG" ? "bg-green-600" : "bg-red-600"}`}
      />
    </span>
  );
}

/** Spicy flame dots (1-3) */
function SpicyLevel({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <span className="flex items-center gap-0.5" title={`Spicy level ${level}/3`}>
      {Array.from({ length: level }).map((_, i) => (
        <span key={i} className="text-[11px]">🌶️</span>
      ))}
    </span>
  );
}

/** Chef special crown badge */
function ChefSpecialBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      <Crown className="size-2.5" />
      Chef&apos;s Special
    </span>
  );
}

export function MenuClient({ data, tableParam }: Props) {
  const { restaurant, table, bestsellers, newItems, reviews, categories } = data;
  const { items, setTable, getSubtotal } = useCart();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [vegFilter, setVegFilter] = useState<"all" | "VEG" | "NON_VEG" | "VEGAN">("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"name" | "price-low" | "price-high">("name");

  useEffect(() => {
    setTable(table.id, table.number);
  }, [table.id, table.number, setTable]);

  const allItems = useMemo(() => {
    const collectItems = (cats: typeof categories, parentName?: string): any[] =>
      cats.flatMap((c) => {
        const displayName = parentName ? `${parentName} > ${c.name}` : c.name;
        const directItems = c.menuItems.map((item) => ({
          ...item,
          categoryName: displayName,
          categoryId: c.id,
        }));
        const childItems = c.children ? collectItems(c.children, displayName) : [];
        return [...directItems, ...childItems];
      });
    return collectItems(categories);
  }, [categories]);

  // Build parent -> children mapping and collect all descendant IDs for filtering
  const categoryChildrenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    categories.forEach((c) => {
      if (c.children) {
        map[c.id] = c.children.map((child) => child.id);
      }
    });
    return map;
  }, [categories]);

  // Top-level (root) categories for display
  const rootCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  // Collect all descendant category IDs for a given category
  const getAllCategoryIds = useMemo(() => {
    const memo: Record<string, string[]> = {};
    const collect = (catId: string): string[] => {
      if (memo[catId]) return memo[catId];
      const ids = [catId];
      const children = categoryChildrenMap[catId] || [];
      children.forEach((childId) => ids.push(...collect(childId)));
      memo[catId] = ids;
      return ids;
    };
    return collect;
  }, [categoryChildrenMap]);

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (activeCategory !== "all") {
      const activeIds = getAllCategoryIds(activeCategory);
      result = result.filter((i) => activeIds.includes(i.categoryId));
    }
    if (vegFilter !== "all") result = result.filter((i) => i.foodType === vegFilter);
    if (search) result = result.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

    result = [...result].sort((a, b) => {
      const priceA = a.discountPrice ?? a.price;
      const priceB = b.discountPrice ?? b.price;
      if (sortBy === "price-low") return priceA - priceB;
      if (sortBy === "price-high") return priceB - priceA;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [allItems, activeCategory, vegFilter, search, sortBy]);

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = getSubtotal();

  const handleService = async (type: "CALL_WAITER" | "REQUEST_BILL") => {
    const result = await requestService(table.id, type);
    if (result.error) toast.error(result.error);
    else toast.success(type === "CALL_WAITER" ? "Waiter has been notified!" : "Bill request sent!");
  };

  const isFiltering = search || activeCategory !== "all" || vegFilter !== "all";

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* ──────────────── Hero Banner ──────────────── */}
      <div className="relative h-52 overflow-hidden sm:h-60">
        {restaurant.banner ? (
          <Image
            src={restaurant.banner}
            alt={restaurant.restaurantName}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <div />
          <ThemeToggle />
        </div>

        {/* Restaurant info */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-end gap-3">
            {restaurant.logo && (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border-2 border-background shadow-lg">
                <Image src={restaurant.logo} alt="" fill className="object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{restaurant.restaurantName}</h1>
              <p className="text-sm text-muted-foreground">Table {table.number} · Dine-In</p>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── Quick Actions ──────────────── */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <Button variant="outline" size="default" className="min-h-11 px-4 text-sm" onClick={() => handleService("CALL_WAITER")}>
          <Bell className="mr-1.5 size-4" />
          Call Waiter
        </Button>
        <Button variant="outline" size="default" className="min-h-11 px-4 text-sm" onClick={() => handleService("REQUEST_BILL")}>
          <Receipt className="mr-1.5 size-4" />
          Request Bill
        </Button>
      </div>

      {/* ──────────────── Bestsellers (horizontal scroll) ──────────────── */}
      {bestsellers.length > 0 && !isFiltering && (
        <section className="px-4 py-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="size-4 text-amber-500" />
            Popular
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
            {bestsellers.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="animate-fadeIn w-40 shrink-0 snap-start rounded-xl border border-border/60 bg-card p-2 text-left transition-shadow hover:shadow-md active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {item.images[0] ? (
                  <div className="relative mb-2 h-28 overflow-hidden rounded-lg">
                    <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                    {item.isChefSpecial && (
                      <div className="absolute left-1 top-1">
                        <span className="flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          <Crown className="size-2" /> Chef
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-2 flex h-28 items-center justify-center rounded-lg bg-muted text-3xl">
                    🍽️
                  </div>
                )}
                <div className="flex items-center gap-1 mb-0.5">
                  <FoodTypeIndicator foodType={item.foodType} />
                  <p className="truncate text-sm font-medium">{item.name}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: restaurant.primaryColor }}>
                  {formatCurrency(item.discountPrice ?? item.price)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ──────────────── New Items (horizontal scroll) ──────────────── */}
      {newItems.length > 0 && !isFiltering && (
        <section className="px-4 py-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            New on Menu
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
            {newItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="animate-fadeIn w-40 shrink-0 snap-start rounded-xl border border-primary/20 bg-primary/5 p-2 text-left transition-shadow hover:shadow-md active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {item.images[0] ? (
                  <div className="relative mb-2 h-28 overflow-hidden rounded-lg">
                    <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                    <div className="absolute right-1 top-1">
                      <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 font-bold">
                        NEW
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 flex h-28 items-center justify-center rounded-lg bg-muted text-3xl">
                    🆕
                  </div>
                )}
                <div className="flex items-center gap-1 mb-0.5">
                  <FoodTypeIndicator foodType={item.foodType} />
                  <p className="truncate text-sm font-medium">{item.name}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: restaurant.primaryColor }}>
                  {formatCurrency(item.discountPrice ?? item.price)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ──────────────── Search & Filters ──────────────── */}
      <div className="sticky top-0 z-20 space-y-3 border-b border-border/60 bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search menu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <Filter className="size-4 shrink-0 text-muted-foreground" />
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-3.5 py-2 min-h-9 text-xs font-medium transition-colors ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {rootCategories.map((cat) => (
            <div key={cat.id} className="shrink-0 flex items-center">
              <button
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-full px-3.5 py-2 min-h-9 text-xs font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.name}
              </button>
              {(cat.children && cat.children.length > 0) && (
                <span className="text-muted-foreground/50 text-[10px] ml-0.5">▸</span>
              )}
            </div>
          ))}
          <button
            onClick={() => setVegFilter(vegFilter === "VEG" ? "all" : "VEG")}
            className={`shrink-0 rounded-full px-3.5 py-2 min-h-9 text-xs font-medium transition-colors ${
              vegFilter === "VEG" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            🥬 Veg
          </button>
          <button
            onClick={() => setVegFilter(vegFilter === "NON_VEG" ? "all" : "NON_VEG")}
            className={`shrink-0 rounded-full px-3.5 py-2 min-h-9 text-xs font-medium transition-colors ${
              vegFilter === "NON_VEG" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            🍖 Non-Veg
          </button>
          <button
            onClick={() => setVegFilter(vegFilter === "VEGAN" ? "all" : "VEGAN")}
            className={`shrink-0 rounded-full px-3.5 py-2 min-h-9 text-xs font-medium transition-colors ${
              vegFilter === "VEGAN" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            🌱 Vegan
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="shrink-0 rounded-full border-0 bg-muted px-3.5 py-2 min-h-9 text-xs text-muted-foreground"
          >
            <option value="name">A-Z</option>
            <option value="price-low">Price ↑</option>
            <option value="price-high">Price ↓</option>
          </select>
        </div>
      </div>

      {/* ──────────────── Menu Grid ──────────────── */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {filteredItems.length === 0 ? (
            <p
              key="empty"
              className="col-span-full py-16 text-center text-muted-foreground"
            >
              No items found
            </p>
          ) : (
            filteredItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="animate-fadeIn overflow-hidden rounded-xl border border-border/60 bg-card text-left transition-all hover:shadow-md active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* Mobile: stacked (image on top). sm+: side-by-side */}
                <div className="flex flex-col sm:flex-row">
                  {/* Item image */}
                  {item.images[0] ? (
                    <div className="relative h-44 w-full shrink-0 overflow-hidden sm:h-28 sm:w-28 lg:h-24 lg:w-24">
                      <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                      {item.isChefSpecial && (
                        <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 py-0.5 text-center text-[9px] font-bold text-white">
                          CHEF&apos;S SPECIAL
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-muted text-3xl sm:h-28 sm:w-28 sm:text-2xl lg:h-24 lg:w-24">
                      🍽️
                    </div>
                  )}

                  {/* Item info */}
                  <div className="flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                        <FoodTypeIndicator foodType={item.foodType} />
                        <SpicyLevel level={item.spicyLevel} />
                        <span className="line-clamp-2 font-semibold text-sm leading-tight">{item.name}</span>
                      </div>
                      {item.isChefSpecial && <ChefSpecialBadge />}
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: restaurant.primaryColor }}>
                          {formatCurrency(item.discountPrice ?? item.price)}
                        </span>
                        {item.discountPrice && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCurrency(item.price)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">· {item.preparationTime} min</span>
                      </div>
                    </div>

                    <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))
          )}
      </div>

      {/* ──────────────── Customer Reviews ──────────────── */}
      {reviews.length > 0 && !isFiltering && (
        <section className="border-t border-border/60 px-4 py-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="size-4 text-amber-500" />
            What Guests Say
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
            {reviews.map((review, i) => (
              <div
                key={review.id}
                className="animate-fadeIn w-64 shrink-0 snap-start rounded-xl border border-border/60 bg-card p-4"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{review.customerName}</p>
                    {review.menuItem && (
                      <p className="text-xs text-muted-foreground">{review.menuItem.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`size-3 ${
                          idx < review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-xs text-muted-foreground line-clamp-3 italic">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ──────────────── Sticky Cart Bar ──────────────── */}
        {cartCount > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            <Link href={`/menu/${tableParam}/cart`}>
              <Button
                className="w-full h-12 text-base font-semibold gap-2"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                <ShoppingBag className="size-5" />
                <span>
                  {cartCount} item{cartCount > 1 ? "s" : ""} · {formatCurrency(cartTotal)}
                </span>
                <ChevronRight className="ml-auto size-5" />
              </Button>
            </Link>
          </div>
        )}

      {/* ──────────────── Item Dialog ──────────────── */}
      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          primaryColor={restaurant.primaryColor}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
