"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
} from "@/actions/menu-items";
import { getCategories, createCategory, deleteCategory } from "@/actions/categories";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toNumber } from "@/lib/decimal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ui/image-upload";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  ChevronRight,
  ChevronDown,
  Search,
  Grid,
  List,
  Leaf,
  Flame,
  Coffee,
  Cake,
  Soup,
  UtensilsCrossed,
  ArrowUpDown,
  Clock,
  Sparkles,
  AlertCircle,
  Eye,
  Check,
  FolderTree,
} from "lucide-react";
import Image from "next/image";
import { ImportDialog } from "@/components/menu-import/import-dialog";

// ── Form state ───────────────────────────────────────────────────────────────

interface ItemFormState {
  name: string;
  description: string;
  price: string;
  discountPrice: string;
  foodType: "VEG" | "NON_VEG" | "VEGAN";
  spicyLevel: string;
  preparationTime: string;
  categoryId: string;
  images: string[];
  ingredients: string;
  allergens: string;
  isChefSpecial: boolean;
  isBestSeller: boolean;
  calories: string;
}

const emptyItem: ItemFormState = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  foodType: "VEG",
  spicyLevel: "0",
  preparationTime: "15",
  categoryId: "",
  images: [],
  ingredients: "",
  allergens: "",
  isChefSpecial: false,
  isBestSeller: false,
  calories: "",
};

// ── Tree Node ────────────────────────────────────────────────────────────────

interface CategoryTreeNode {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  parentId: string | null;
  children: CategoryTreeNode[];
  itemCount: number;
}

// ── Helper: build tree from flat list ────────────────────────────────────────

function buildCategoryTree(
  categories: Array<{ id: string; name: string; parentId: string | null; sortOrder: number; description?: string | null; children?: any[] }>,
  itemCounts: Record<string, number>,
): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, {
      id: cat.id,
      name: cat.name,
      description: cat.description ?? null,
      sortOrder: cat.sortOrder,
      parentId: cat.parentId,
      children: [],
      itemCount: 0,
    });
  });

  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const calculateCounts = (node: CategoryTreeNode): number => {
    let count = itemCounts[node.id] || 0;
    node.children.forEach((child) => {
      count += calculateCounts(child);
    });
    node.itemCount = count;
    return count;
  };

  roots.forEach(calculateCounts);
  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  return roots;
}

// ── Helper: flatten tree for category select ─────────────────────────────────

function flattenTreeForSelect(
  nodes: CategoryTreeNode[],
  depth = 0,
): Array<{ id: string; label: string; depth: number }> {
  const result: Array<{ id: string; label: string; depth: number }> = [];
  nodes.forEach((node) => {
    result.push({ id: node.id, label: node.name, depth });
    if (node.children.length > 0) {
      result.push(...flattenTreeForSelect(node.children, depth + 1));
    }
  });
  return result;
}

// ── Helper: find breadcrumb path from tree ───────────────────────────────────

function findBreadcrumbPath(
  nodes: CategoryTreeNode[],
  targetId: string,
  path: CategoryTreeNode[] = [],
): CategoryTreeNode[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [...path, node];
    const result = findBreadcrumbPath(node.children, targetId, [...path, node]);
    if (result) return result;
  }
  return null;
}

// ── Helper: collect all descendant IDs ───────────────────────────────────────

function collectAllIds(node: CategoryTreeNode): string[] {
  const ids = [node.id];
  node.children.forEach((child) => ids.push(...collectAllIds(child)));
  return ids;
}

// ── Helper: get tree node by ID ──────────────────────────────────────────────

function findTreeNode(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findTreeNode(node.children, id);
    if (found) return found;
  }
  return null;
}

// ── Helper: get category full path name ──────────────────────────────────────

function getCategoryPathName(
  nodes: CategoryTreeNode[],
  targetId: string,
  parts: string[] = [],
): string | null {
  for (const node of nodes) {
    if (node.id === targetId) return [...parts, node.name].join(" > ");
    const result = getCategoryPathName(node.children, targetId, [...parts, node.name]);
    if (result) return result;
  }
  return null;
}

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItem);
  const [editId, setEditId] = useState<string | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catName, setCatName] = useState("");
  const [catParentId, setCatParentId] = useState<string>("__root__");
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "available" | "unavailable" | "bestseller">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [layoutView, setLayoutView] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "price-low" | "price-high">("name");

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["menuItems"],
    queryFn: () => getMenuItems(),
    refetchInterval: 15000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    refetchInterval: 15000,
  });

  // Build tree
  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
    });
    return counts;
  }, [items]);

  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories, categoryItemCounts);
  }, [categories, categoryItemCounts]);

  const flatCategories = useMemo(() => flattenTreeForSelect(categoryTree), [categoryTree]);

  // Auto-select first category
  useEffect(() => {
    if (categoryTree.length > 0 && (!activeCategoryId || !findTreeNode(categoryTree, activeCategoryId))) {
      setActiveCategoryId(categoryTree[0].id);
    }
  }, [categoryTree, activeCategoryId]);

  // Auto-expand root nodes
  useEffect(() => {
    if (categoryTree.length > 0) {
      setExpandedNodes((prev) => {
        const next = { ...prev };
        categoryTree.forEach((node) => {
          if (node.children.length > 0 && next[node.id] === undefined) {
            next[node.id] = true;
          }
        });
        return next;
      });
    }
  }, [categoryTree]);

  // Breadcrumb for active category
  const activeBreadcrumb = useMemo(() => {
    if (!activeCategoryId || categoryTree.length === 0) return [];
    return findBreadcrumbPath(categoryTree, activeCategoryId) || [];
  }, [categoryTree, activeCategoryId]);

  // Active category node
  const activeNode = useMemo(() => {
    if (!activeCategoryId || categoryTree.length === 0) return null;
    return findTreeNode(categoryTree, activeCategoryId);
  }, [categoryTree, activeCategoryId]);

  // All category IDs under the active selection (for item filtering)
  const activeCategoryIds = useMemo(() => {
    if (!activeNode) return [];
    return collectAllIds(activeNode);
  }, [activeNode]);

  const stats = useMemo(() => {
    const total = items.length;
    const veg = items.filter(i => i.foodType === "VEG" || i.foodType === "VEGAN").length;
    const nonVeg = items.filter(i => i.foodType === "NON_VEG").length;
    const unavailable = items.filter(i => !i.isAvailable).length;
    return { total, veg, nonVeg, unavailable };
  }, [items]);

  const displayedItems = useMemo(() => {
    let result = items;
    if (activeCategoryId) {
      result = result.filter(i => activeCategoryIds.includes(i.categoryId));
    }
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    if (filterTab === "available") {
      result = result.filter(i => i.isAvailable);
    } else if (filterTab === "unavailable") {
      result = result.filter(i => !i.isAvailable);
    } else if (filterTab === "bestseller") {
      result = result.filter(i => i.isBestSeller);
    }
    return [...result].sort((a, b) => {
      if (sortBy === "price-low") return toNumber(a.discountPrice) - toNumber(a.price) > toNumber(b.discountPrice) - toNumber(b.price) ? 1 : -1;
      if (sortBy === "price-high") return toNumber(b.discountPrice) - toNumber(b.price) > toNumber(a.discountPrice) - toNumber(a.price) ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [items, activeCategoryIds, activeCategoryId, globalSearch, searchQuery, filterTab, sortBy]);

  const activeCategoryName = activeBreadcrumb.length > 0
    ? activeBreadcrumb[activeBreadcrumb.length - 1].name
    : "All";

  const resetForm = () => {
    setItemForm(emptyItem);
    setEditId(null);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return toast.error("Name is required");
    if (!itemForm.price) return toast.error("Price is required");
    if (!itemForm.categoryId) return toast.error("Category is required");

    setSaving(true);

    const data = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || undefined,
      price: parseFloat(itemForm.price),
      discountPrice: itemForm.discountPrice ? parseFloat(itemForm.discountPrice) : null,
      foodType: itemForm.foodType,
      spicyLevel: parseInt(itemForm.spicyLevel),
      preparationTime: parseInt(itemForm.preparationTime),
      categoryId: itemForm.categoryId,
      images: itemForm.images,
      ingredients: itemForm.ingredients
        ? itemForm.ingredients.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      allergens: itemForm.allergens
        ? itemForm.allergens.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      isChefSpecial: itemForm.isChefSpecial,
      isBestSeller: itemForm.isBestSeller,
      nutrition: itemForm.calories ? { calories: parseInt(itemForm.calories) } : undefined,
      variants: [],
      addons: [],
    };

    const result = editId
      ? await updateMenuItem(editId, data)
      : await createMenuItem(data);

    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editId ? "Item updated" : "Item created");
      setItemDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
    }
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditId(item.id);
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      discountPrice: item.discountPrice ? String(item.discountPrice) : "",
      foodType: (item.foodType ?? "VEG") as "VEG" | "NON_VEG" | "VEGAN",
      spicyLevel: String(item.spicyLevel),
      preparationTime: String(item.preparationTime),
      categoryId: item.categoryId,
      images: item.images,
      ingredients: item.ingredients.join(", "),
      allergens: item.allergens.join(", "),
      isChefSpecial: item.isChefSpecial ?? false,
      isBestSeller: item.isBestSeller ?? false,
      calories: String((item.nutrition as any)?.calories || ""),
    });
    setItemDialogOpen(true);
  };

  const handleDuplicate = (item: typeof items[0]) => {
    setItemForm({
      name: `${item.name} (Copy)`,
      description: item.description ?? "",
      price: String(item.price),
      discountPrice: item.discountPrice ? String(item.discountPrice) : "",
      foodType: (item.foodType ?? "VEG") as "VEG" | "NON_VEG" | "VEGAN",
      spicyLevel: String(item.spicyLevel),
      preparationTime: String(item.preparationTime),
      categoryId: item.categoryId,
      images: item.images,
      ingredients: item.ingredients.join(", "),
      allergens: item.allergens.join(", "),
      isChefSpecial: item.isChefSpecial ?? false,
      isBestSeller: item.isBestSeller ?? false,
      calories: String((item.nutrition as any)?.calories || ""),
    });
    setEditId(null);
    setItemDialogOpen(true);
    toast.info("Filled form with duplicate state. Click 'Create Item' to save.");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this menu item? Its images will also be removed.")) return;
    const result = await deleteMenuItem(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const result = await toggleMenuItemAvailability(id, !current);
    if (result.error) toast.error(result.error);
    else {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
    }
  };

  const handleCreateCategory = async () => {
    const result = await createCategory({
      name: catName,
      parentId: catParentId === "__root__" ? null : catParentId,
    });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Category created");
      setCatName("");
      setCatParentId("__root__");
      setCatDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  };

  const handleDeleteCategory = async (cat: CategoryTreeNode) => {
    if (confirm(`Delete "${cat.name}"? All items in this category and its subcategories will be deleted.`)) {
      const result = await deleteCategory(cat.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Category deleted");
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      }
    }
  };

  // Category icons for root nodes
  const categoryIcons: Record<string, { icon: typeof Leaf; bg: string }> = {
    "vegetarian": { icon: Leaf, bg: "bg-green-50 text-green-600 border-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50" },
    "non-vegetarian": { icon: Flame, bg: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50" },
    "non veg": { icon: Flame, bg: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50" },
    "beverages": { icon: Coffee, bg: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50" },
    "desserts": { icon: Cake, bg: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50" },
    "soups & salads": { icon: Soup, bg: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" },
  };

  const renderTreeNodes = (nodes: CategoryTreeNode[], level = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedNodes[node.id] ?? false;
      const isSelected = activeCategoryId === node.id;
      const isRoot = level === 0;
      const iconInfo = isRoot ? categoryIcons[node.name.toLowerCase()] : undefined;
      const IconComponent = iconInfo?.icon ?? UtensilsCrossed;
      const iconBg = iconInfo?.bg ?? "bg-gray-50 text-gray-500 border-gray-100";

      return (
        <div key={node.id} className="select-none">
          <div
            className={cn(
              "group flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer transition-all duration-150 my-0.5",
              isSelected
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-450 font-bold"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
            )}
            style={{ paddingLeft: `${level * 14 + 6}px` }}
            onClick={() => setActiveCategoryId(node.id)}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNodes((prev) => ({ ...prev, [node.id]: !prev[node.id] }));
                }}
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 shrink-0 cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className={cn("size-3.5", isSelected && "text-blue-700 dark:text-blue-450")} />
                ) : (
                  <ChevronRight className={cn("size-3.5", isSelected && "text-blue-700 dark:text-blue-450")} />
                )}
              </button>
            ) : isSelected ? (
              <ChevronRight className="size-3.5 text-blue-700 dark:text-blue-450 shrink-0" />
            ) : (
              <span className="w-4.5 shrink-0" />
            )}

            {isRoot && (
              <div className={cn("size-7 rounded-full flex items-center justify-center border shrink-0", iconBg)}>
                <IconComponent className="size-3.5" />
              </div>
            )}

            {!isRoot && level === 1 && (
              <FolderTree className="size-3.5 text-gray-400 shrink-0" />
            )}

            <span className={cn(
              "truncate flex-1",
              level >= 2 ? "text-[11px] font-medium" : "text-xs font-bold"
            )}>
              {node.name}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  isSelected
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                    : "bg-gray-100 dark:bg-gray-805 text-gray-500"
                )}
              >
                {node.itemCount}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCategory(node);
                }}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-0.5 text-xs font-bold"
                title="Delete Category"
              >
                ×
              </button>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="mt-0.5 border-l border-gray-100 dark:border-gray-800 ml-3.5 pl-1">
              {renderTreeNodes(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-dvh bg-gray-50/50 dark:bg-gray-900/40 pb-12">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-900 px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Menu Management</h1>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Organize your menu categories and items</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search menu..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-9 h-8 sm:h-9 bg-gray-50/50 border-gray-200 text-xs rounded-lg dark:bg-gray-900/50 focus-visible:ring-1"
            />
          </div>

          <div
            className="flex size-8 sm:size-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 relative cursor-pointer hover:bg-gray-200 shrink-0"
            onClick={() => setImportDialogOpen(true)}
            title="AI Menu Import"
          >
            <Sparkles className="size-4" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6 max-w-7.5xl mx-auto">
        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Total Items",
              valueText: String(stats.total),
              trend: "+12%",
              trendColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
              icon: UtensilsCrossed,
              iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
            },
            {
              title: "Vegetarian",
              valueText: `${stats.veg} items`,
              trend: "+8%",
              trendColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
              icon: Leaf,
              iconBg: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
            },
            {
              title: "Non-Vegetarian",
              valueText: `${stats.nonVeg} items`,
              trend: "+15%",
              trendColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
              icon: Flame,
              iconBg: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400",
            },
            {
              title: "Unavailable",
              valueText: `${stats.unavailable} items`,
              trend: "-3%",
              trendColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400",
              icon: AlertCircle,
              iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
            },
          ].map((item, idx) => (
            <Card key={idx} className="border-0 shadow-sm bg-white dark:bg-gray-950 overflow-hidden">
              <CardContent className="px-3 py-1.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("size-9 rounded-xl flex items-center justify-center shrink-0", item.iconBg)}>
                    <item.icon className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{item.title}</p>
                    <p className="text-base font-black text-gray-950 dark:text-white leading-none mt-1">
                      {item.valueText}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className={cn("text-[9px] px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5", item.trendColor)}>
                    {item.trend.startsWith("+") ? "↗" : "↘"} {item.trend.replace("+", "").replace("-", "")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Workspace ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6 items-start">
          {/* Left: Tree Sidebar */}
          <div className="col-span-1 lg:col-span-3 bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-900 shadow-sm p-3 sm:p-4 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">Menu Categories</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCatDialogOpen(true)}
                className="h-6 sm:h-7 text-[10px] font-bold px-2 sm:px-2.5 rounded-lg border-gray-200"
              >
                <Plus className="mr-1 size-3" />
                Add
              </Button>
            </div>

            <div className="overflow-y-auto max-h-[40vh] lg:max-h-[60vh] pr-1">
              {categoryTree.length > 0 ? (
                renderTreeNodes(categoryTree)
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No categories yet. Click Add to create one.</p>
              )}
            </div>
          </div>

          {/* Right: Items Workspace */}
          <div className="col-span-1 lg:col-span-9 space-y-3 sm:space-y-4">
            {/* Breadcrumb & Title */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white dark:bg-gray-950 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-900 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  <Leaf className="size-3 text-green-500 mr-0.5" />
                  {activeBreadcrumb.map((node, idx) => (
                    <span key={node.id} className="flex items-center">
                      <button
                        onClick={() => setActiveCategoryId(node.id)}
                        className={cn(
                          "hover:underline",
                          idx === activeBreadcrumb.length - 1 ? "text-gray-700 dark:text-gray-300" : "text-gray-400"
                        )}
                      >
                        {node.name}
                      </button>
                      {idx < activeBreadcrumb.length - 1 && <ChevronRight className="size-3 mx-1 text-gray-300" />}
                    </span>
                  ))}
                </div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  {activeCategoryName} Dishes
                </h2>
                <p className="text-xs text-gray-500">
                  {displayedItems.length} items
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-8 text-xs border-gray-200 rounded-lg w-28 bg-gray-50/50">
                    <ArrowUpDown className="size-3 text-gray-400 mr-1.5" />
                    <SelectValue placeholder="Sort">
                      {(value: any) => {
                        const labels: Record<string, string> = { name: "A\u2013Z", "price-low": "Price: Low\u2013High", "price-high": "Price: High\u2013Low" };
                        return labels[value] || value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">A-Z</SelectItem>
                    <SelectItem value="price-low">Price: Low-High</SelectItem>
                    <SelectItem value="price-high">Price: High-Low</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden h-8 bg-gray-50/50">
                  <button
                    onClick={() => setLayoutView("grid")}
                    className={cn(
                      "p-1.5 text-gray-500 hover:text-gray-700",
                      layoutView === "grid" && "bg-white dark:bg-gray-900 text-blue-600 shadow-sm font-bold"
                    )}
                  >
                    <Grid className="size-4" />
                  </button>
                  <button
                    onClick={() => setLayoutView("list")}
                    className={cn(
                      "p-1.5 text-gray-500 hover:text-gray-700",
                      layoutView === "list" && "bg-white dark:bg-gray-900 text-blue-600 shadow-sm font-bold"
                    )}
                  >
                    <List className="size-4" />
                  </button>
                </div>

                <Button
                  onClick={() => {
                    resetForm();
                    if (activeNode) {
                      setItemForm(prev => ({ ...prev, categoryId: activeNode.id }));
                    }
                    setItemDialogOpen(true);
                  }}
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg px-3 bg-gray-900 text-white hover:bg-gray-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  <Plus className="mr-1 size-3.5" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Filter Pills & Mini Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-100 dark:border-gray-900 shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: "all", label: `All (${displayedItems.length})` },
                  { id: "available", label: "Available" },
                  { id: "unavailable", label: "Unavailable" },
                  { id: "bestseller", label: "Bestseller" },
                ].map((tab) => {
                  const isActive = filterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setFilterTab(tab.id as any)}
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-full border transition-colors shrink-0",
                        isActive
                          ? "bg-gray-900 border-gray-900 text-white dark:bg-blue-600 dark:border-blue-600"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-gray-400" />
                <Input
                  type="text"
                  placeholder={`Search in ${activeCategoryName.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-7.5 text-xs bg-gray-50/50 border-gray-200 rounded-lg dark:bg-gray-900/50"
                />
              </div>
            </div>

            {/* Display list of Items */}
            {displayedItems.length === 0 ? (
              <Card className="border-0 shadow-sm bg-white dark:bg-gray-950 py-16">
                <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
                  <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                    <UtensilsCrossed className="size-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">No items found</p>
                  <p className="text-xs text-gray-500 max-w-xs">
                    Try checking other subcategories, modifying filters, or add a new menu item to this category.
                  </p>
                </CardContent>
              </Card>
            ) : layoutView === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedItems.map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      "border-0 shadow-sm bg-white dark:bg-gray-950 overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-md",
                      !item.isAvailable && "opacity-75"
                    )}
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-150">
                      {item.images[0] ? (
                        <Image
                          src={item.images[0]}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-3xl">
                          🍽️
                        </div>
                      )}

                      <div className="absolute inset-x-2 top-2 flex items-center justify-between pointer-events-none">
                        {item.isBestSeller ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg border-0 shadow">
                            Bestseller
                          </Badge>
                        ) : item.isChefSpecial ? (
                          <Badge className="bg-amber-800 hover:bg-amber-900 text-white font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg border-0 shadow">
                            Chef&apos;s Special
                          </Badge>
                        ) : item.discountPrice ? (
                          <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg border-0 shadow">
                            Offer
                          </Badge>
                        ) : (
                          <span />
                        )}

                        <Badge
                          className={cn(
                            "font-bold text-[9px] px-1.5 py-0.2 rounded border-0 shadow shrink-0 pointer-events-auto",
                            item.foodType === "VEG" && "bg-green-50 text-green-700 border border-green-600/20",
                            item.foodType === "NON_VEG" && "bg-red-50 text-red-700 border border-red-600/20",
                            item.foodType === "VEGAN" && "bg-emerald-50 text-emerald-700 border border-emerald-600/20"
                          )}
                        >
                          {item.foodType === "VEG" && "Veg"}
                          {item.foodType === "NON_VEG" && "Non-Veg"}
                          {item.foodType === "VEGAN" && "Vegan"}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-sm text-gray-950 dark:text-white line-clamp-1">
                            {item.name}
                          </h3>
                        </div>
                        {item.category?.name && (
                          <span className="inline-block text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-1.5 py-0.5 rounded-md">
                            {item.category.name}
                          </span>
                        )}
                        <p className="text-xs text-gray-500 line-clamp-2 h-8 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-900 pt-2.5">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-black text-sm text-gray-900 dark:text-white">
                              {formatCurrency(item.discountPrice ?? item.price)}
                            </span>
                            {item.discountPrice && (
                              <span className="text-[10px] text-gray-400 line-through">
                                {formatCurrency(item.price)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
                          <span className="flex items-center gap-0.5">
                            <Clock className="size-3 text-gray-300" />
                            {item.preparationTime}m
                          </span>
                          <span>•</span>
                          <span>{(item.nutrition as any)?.calories || 300} cal</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-900 pt-2.5">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.isAvailable}
                            onCheckedChange={() => handleToggle(item.id, item.isAvailable)}
                            aria-label="Toggle availability"
                            className="scale-90"
                          />
                          <span className="text-[10px] font-bold text-gray-500">
                            {item.isAvailable ? "Available" : "Unavailable"}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                            onClick={() => handleEdit(item)}
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                            onClick={() => handleDuplicate(item)}
                            title="Duplicate"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedItems.map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      "border-0 shadow-sm bg-white dark:bg-gray-950 overflow-hidden group transition-all duration-300 hover:shadow-md",
                      !item.isAvailable && "opacity-75"
                    )}
                  >
                    <CardContent className="p-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                          {item.images[0] ? (
                            <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-lg">🍽️</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">{item.name}</h3>
                            <Badge
                              className={cn(
                                "text-[9px] font-extrabold px-1 py-0.1 border-0 shadow-none shrink-0 pointer-events-none scale-90",
                                item.foodType === "VEG" && "bg-green-50 text-green-700",
                                item.foodType === "NON_VEG" && "bg-red-50 text-red-700",
                                item.foodType === "VEGAN" && "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {item.foodType}
                            </Badge>
                            {item.category?.name && (
                              <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-1 py-0.1 rounded shrink-0 pointer-events-none scale-90">
                                {item.category.name}
                              </span>
                            )}
                            {item.isBestSeller && (
                              <Badge className="bg-amber-500 text-white text-[8px] font-black scale-90">Best</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-1 leading-relaxed">{item.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <p className="font-black text-sm text-gray-900 dark:text-white">
                            {formatCurrency(item.discountPrice ?? item.price)}
                          </p>
                          {item.discountPrice && (
                            <p className="text-[10px] text-gray-400 line-through">{formatCurrency(item.price)}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.isAvailable}
                            onCheckedChange={() => handleToggle(item.id, item.isAvailable)}
                            className="scale-90"
                          />
                          <span className="text-[10px] font-extrabold text-gray-500 w-12">
                            {item.isAvailable ? "Available" : "Unavail"}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 border-l border-gray-100 pl-3">
                          <Button variant="ghost" size="icon" className="size-7 text-gray-400 hover:text-gray-900 hover:bg-gray-100" onClick={() => handleEdit(item)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-gray-400 hover:text-gray-900 hover:bg-gray-100" onClick={() => handleDuplicate(item)}>
                            <Copy className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-red-400 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Item Dialog ── */}
      <Dialog
        open={itemDialogOpen}
        onOpenChange={(o) => {
          setItemDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-extrabold">{editId ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Name <span className="text-destructive">*</span></Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="e.g. Paneer Butter Masala"
                className="h-9 border-gray-200 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Short description of the dish"
                rows={2}
                className="border-gray-200 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Price (₹) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                  placeholder="199"
                  className="h-9 border-gray-200 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Discounted Price (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.discountPrice}
                  onChange={(e) => setItemForm({ ...itemForm, discountPrice: e.target.value })}
                  placeholder="149"
                  className="h-9 border-gray-200 text-xs"
                />
              </div>
            </div>

            {/* Category — hierarchical select */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Category <span className="text-destructive">*</span></Label>
              <Select
                value={itemForm.categoryId}
                onValueChange={(v) => v && setItemForm({ ...itemForm, categoryId: v })}
              >
                <SelectTrigger className="h-9 border-gray-200 text-xs">
                  <SelectValue placeholder="Select category">
                    {(value: any) => {
                      if (!value) return null;
                      const cat = flatCategories.find((c) => c.id === value);
                      if (cat) return `${cat.depth > 0 ? "\u00A0\u00A0".repeat(cat.depth) + "└ " : ""}${cat.label}`;
                      const item = items.find((i) => i.categoryId === value);
                      if (item?.category?.name) return item.category.name;
                      return value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {flatCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.depth > 0 ? "\u00A0\u00A0".repeat(c.depth) + "└ " : ""}{c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Images</Label>
              <ImageUpload
                value={itemForm.images}
                onChange={(urls) => setItemForm({ ...itemForm, images: urls })}
                maxImages={5}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Food Type <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "VEG", label: "Veg", dot: "bg-green-600", active: "bg-green-50 border-green-600 text-green-700 dark:bg-green-950/40" },
                    { value: "NON_VEG", label: "Non-Veg", dot: "bg-red-600", active: "bg-red-50 border-red-600 text-red-700 dark:bg-red-950/40" },
                    { value: "VEGAN", label: "Vegan", dot: "bg-emerald-500", active: "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40" },
                  ] as const
                ).map(({ value, label, dot, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setItemForm({ ...itemForm, foodType: value })}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-2 text-xs font-bold transition-colors ${
                      itemForm.foodType === value ? active : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    <span className={`size-3 rounded-sm border-2 ${itemForm.foodType === value ? dot.replace("bg-", "border-") : "border-gray-400"} flex items-center justify-center`}>
                      <span className={`size-1.5 rounded-full ${itemForm.foodType === value ? dot : "bg-gray-400"}`} />
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6 border border-gray-150 rounded-lg p-3 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isBestSeller"
                  checked={itemForm.isBestSeller}
                  onCheckedChange={(checked) => setItemForm({ ...itemForm, isBestSeller: !!checked })}
                />
                <Label htmlFor="isBestSeller" className="text-xs font-bold cursor-pointer text-gray-700">Mark Bestseller</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isChefSpecial"
                  checked={itemForm.isChefSpecial}
                  onCheckedChange={(checked) => setItemForm({ ...itemForm, isChefSpecial: !!checked })}
                />
                <Label htmlFor="isChefSpecial" className="text-xs font-bold cursor-pointer text-gray-700">Mark Chef&apos;s Special</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Spicy Level</Label>
                <Select value={itemForm.spicyLevel} onValueChange={(v) => v && setItemForm({ ...itemForm, spicyLevel: v })}>
                  <SelectTrigger className="h-9 border-gray-200 text-xs">
                    <SelectValue>
                      {(value: any) => {
                        const labels: Record<string, string> = { "0": "0 — Not spicy", "1": "1 — Mild 🌶️", "2": "2 — Medium 🌶️🌶️", "3": "3 — Hot 🌶️🌶️🌶️" };
                        return labels[value] || value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 — Not spicy</SelectItem>
                    <SelectItem value="1">1 — Mild 🌶️</SelectItem>
                    <SelectItem value="2">2 — Medium 🌶️🌶️</SelectItem>
                    <SelectItem value="3">3 — Hot 🌶️🌶️🌶️</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Prep Time (min)</Label>
                <Input type="number" min="1" value={itemForm.preparationTime} onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })} className="h-9 border-gray-200 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Calories (cal)</Label>
                <Input type="number" min="0" value={itemForm.calories} onChange={(e) => setItemForm({ ...itemForm, calories: e.target.value })} placeholder="300" className="h-9 border-gray-200 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Ingredients</Label>
                <Input value={itemForm.ingredients} onChange={(e) => setItemForm({ ...itemForm, ingredients: e.target.value })} placeholder="Paneer, Tomato, Butter" className="h-9 border-gray-200 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Allergens</Label>
                <Input value={itemForm.allergens} onChange={(e) => setItemForm({ ...itemForm, allergens: e.target.value })} placeholder="Dairy, Gluten" className="h-9 border-gray-200 text-xs" />
              </div>
            </div>

            <Button onClick={handleSaveItem} disabled={saving || !itemForm.name || !itemForm.price || !itemForm.categoryId} className="w-full mt-2 font-bold">
              {saving ? "Saving…" : editId ? "Update Item" : "Create Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Category Dialog ── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-extrabold">New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Parent Category</Label>
              <Select value={catParentId} onValueChange={(v) => setCatParentId(v ?? "__root__")}>
                <SelectTrigger className="h-9 border-gray-200 text-xs">
                  <SelectValue placeholder="Top level">
                    {(value: any) => {
                      if (value === "__root__") return "— Top Level —";
                      const cat = flatCategories.find((c) => c.id === value);
                      if (cat) return `${cat.depth > 0 ? "\u00A0\u00A0".repeat(cat.depth) + "└ " : ""}${cat.label}`;
                      return value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">— Top Level —</SelectItem>
                  {flatCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.depth > 0 ? "\u00A0\u00A0".repeat(c.depth) + "└ " : ""}{c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Category Name</Label>
              <Input
                placeholder="e.g. Main Course"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="h-9 border-gray-200 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter" && catName) handleCreateCategory(); }}
              />
            </div>
            <Button onClick={handleCreateCategory} disabled={!catName} className="w-full font-bold">
              Create Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI Menu Import Dialog ── */}
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
