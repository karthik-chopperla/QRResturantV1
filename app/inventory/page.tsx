"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Role } from "@prisma/client";
import {
  adjustIngredientStock,
  createIngredientCategory,
  getIngredientStockHistory,
  getInventoryReportData,
  getInventoryData,
  recordExpiredBatchWastage,
  setIngredientActive,
  setIngredientStockCount,
  saveIngredient,
  saveRecipe,
} from "@/actions/inventory";
import { createPurchaseRequest } from "@/actions/purchasing";
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

type InventoryData = Awaited<ReturnType<typeof getInventoryData>>;
type Ingredient = Extract<InventoryData, { ingredients: unknown }>["ingredients"][number];

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-data"],
    queryFn: getInventoryData,
    refetchInterval: 15000,
  });
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    unit: "kg",
    quantityOnHand: "0",
    minimumQuantity: "0",
    unitCost: "0",
    categoryId: "",
    batchNumber: "",
    expiresAt: "",
  });
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [recipeMenuId, setRecipeMenuId] = useState("");
  const [recipeScopeType, setRecipeScopeType] = useState<"BASE" | "VARIANT" | "ADDON">("BASE");
  const [recipeScopeId, setRecipeScopeId] = useState("");
  const [recipeLines, setRecipeLines] = useState([
    { ingredientId: "", quantity: "" },
  ]);
  const loadedRecipeSelection = useRef<string | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW" | "IN_STOCK" | "INACTIVE">("ALL");
  const [historyIngredientId, setHistoryIngredientId] = useState("");
  const [requestLines, setRequestLines] = useState([{ ingredientId: "", quantity: "" }]);
  const [requestNotes, setRequestNotes] = useState("");
  const [reportType, setReportType] = useState<
    "current-stock" | "low-stock" | "consumption" | "wastage" | "purchase-history"
  >("current-stock");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    error: historyQueryError,
  } = useQuery({
    queryKey: ["inventory-history", historyIngredientId],
    queryFn: () => getIngredientStockHistory(historyIngredientId),
    enabled: Boolean(historyIngredientId),
  });

  useEffect(() => {
    void getCurrentUser().then((user) => setUserRole(user?.role ?? null));
  }, []);

  const ingredients = data && "ingredients" in data ? data.ingredients ?? [] : [];
  const categories = data && "categories" in data ? data.categories ?? [] : [];
  const movements = data && "movements" in data ? data.movements ?? [] : [];
  const menuItems = useMemo(
    () => (data && "menuItems" in data ? data.menuItems ?? [] : []),
    [data]
  );
  const purchaseRequests =
    data && "purchaseRequests" in data ? data.purchaseRequests ?? [] : [];
  const lowStockNotifications =
    data && "lowStockNotifications" in data
      ? data.lowStockNotifications ?? []
      : [];
  const historyMovements = Array.isArray(historyData) ? historyData : [];
  const activeIngredients = ingredients.filter((ingredient) => ingredient.isActive);
  const lowStock = ingredients.filter(
    (ingredient) =>
      ingredient.isActive &&
      Number(ingredient.quantityOnHand) <= Number(ingredient.minimumQuantity)
  ).length;
  const totalStockValue = activeIngredients.reduce(
    (sum, ingredient) =>
      sum + Number(ingredient.quantityOnHand) * Number(ingredient.unitCost),
    0
  );
  const filteredIngredients = ingredients.filter((ingredient) => {
    const matchesText = ingredient.name.toLowerCase().includes(ingredientSearch.toLowerCase());
    const matchesCategory = !categoryFilter || ingredient.categoryId === categoryFilter;
    const matchesStatus =
      stockFilter === "ALL" ||
      (stockFilter === "INACTIVE" && !ingredient.isActive) ||
      (ingredient.isActive &&
        ((stockFilter === "LOW" &&
          Number(ingredient.quantityOnHand) <= Number(ingredient.minimumQuantity)) ||
          (stockFilter === "IN_STOCK" &&
            Number(ingredient.quantityOnHand) > Number(ingredient.minimumQuantity))));
    return matchesText && matchesCategory && matchesStatus;
  });
  const selectedMenuItem = menuItems.find((item) => item.id === recipeMenuId);
  const recipeScopeOptions =
    recipeScopeType === "VARIANT"
      ? selectedMenuItem?.variants ?? []
      : recipeScopeType === "ADDON"
        ? selectedMenuItem?.addons ?? []
        : [];
  const selectedRecipeItems =
    selectedMenuItem?.recipeItems.filter((item) =>
      recipeScopeType === "BASE"
        ? !item.variantId && !item.addonId
        : recipeScopeType === "VARIANT"
          ? item.variantId === recipeScopeId
          : item.addonId === recipeScopeId
    ) ?? [];
  const expiringBatches = ingredients.flatMap((ingredient) =>
    ingredient.batches
      .filter(
        (batch) =>
          batch.expiresAt &&
          new Date(batch.expiresAt).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000
      )
      .map((batch) => ({ ingredient, batch }))
  );

  const recipeSelectionKey = `${recipeMenuId}:${recipeScopeType}:${recipeScopeId}`;
  useEffect(() => {
    if (loadedRecipeSelection.current === recipeSelectionKey) return;
    if (!recipeMenuId || (recipeScopeType !== "BASE" && !recipeScopeId)) {
      loadedRecipeSelection.current = recipeSelectionKey;
      setRecipeLines([{ ingredientId: "", quantity: "" }]);
      return;
    }

    const menuItem = menuItems.find((item) => item.id === recipeMenuId);
    if (!menuItem) return;

    const recipeItems =
      menuItem?.recipeItems.filter((item) =>
        recipeScopeType === "BASE"
          ? !item.variantId && !item.addonId
          : recipeScopeType === "VARIANT"
            ? item.variantId === recipeScopeId
            : item.addonId === recipeScopeId
      ) ?? [];
    loadedRecipeSelection.current = recipeSelectionKey;
    setRecipeLines(
      recipeItems.length
        ? recipeItems.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: String(item.quantity),
          }))
        : [{ ingredientId: "", quantity: "" }]
    );
  }, [recipeMenuId, recipeScopeId, recipeScopeType, recipeSelectionKey, menuItems]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["inventory-data"] });
  };

  const handleCreateCategory = async () => {
    const result = await createIngredientCategory(newCategory);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Ingredient category created");
      setNewCategory("");
      await refresh();
    }
  };

  const handleSaveIngredient = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await saveIngredient({
      ...ingredientForm,
      quantityOnHand: Number(ingredientForm.quantityOnHand),
      minimumQuantity: Number(ingredientForm.minimumQuantity),
      unitCost: Number(ingredientForm.unitCost),
      categoryId: ingredientForm.categoryId || null,
      batchNumber: ingredientForm.batchNumber || null,
      expiresAt: ingredientForm.expiresAt || null,
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Ingredient saved");
      setIngredientForm({
        name: "",
        unit: "kg",
        quantityOnHand: "0",
        minimumQuantity: "0",
        unitCost: "0",
        categoryId: "",
        batchNumber: "",
        expiresAt: "",
      });
      await refresh();
    }
  };

  const handleAdjustment = async (
    ingredient: Ingredient,
    type: "ADJUSTMENT" | "WASTAGE"
  ) => {
    const quantity = Number(adjustments[ingredient.id]);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }
    const reason = window.prompt(
      type === "WASTAGE" ? "Reason for wastage" : "Reason for stock addition"
    );
    if (!reason?.trim()) return;
    const batchNumber =
      type === "ADJUSTMENT"
        ? window.prompt("Batch number (optional)") ?? ""
        : "";
    const expiresAt =
      type === "ADJUSTMENT"
        ? window.prompt("Expiry date YYYY-MM-DD (optional)") ?? ""
        : "";
    if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
      toast.error("Enter expiry as YYYY-MM-DD.");
      return;
    }
    const result = await adjustIngredientStock({
      ingredientId: ingredient.id,
      quantity,
      type,
      reason,
      ...(batchNumber.trim() ? { batchNumber: batchNumber.trim() } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Stock movement recorded");
      setAdjustments((current) => ({ ...current, [ingredient.id]: "" }));
      await refresh();
    }
  };

  const handleSaveRecipe = async () => {
    if (!recipeMenuId) {
      toast.error("Select a menu item.");
      return;
    }
    const ingredientsForRecipe = recipeLines
      .filter((line) => line.ingredientId && Number(line.quantity) > 0)
      .map((line) => ({
        ingredientId: line.ingredientId,
        quantity: Number(line.quantity),
      }));
    if (recipeScopeType !== "BASE" && !recipeScopeId) {
      toast.error("Select a recipe variant or add-on.");
      return;
    }
    const scope =
      recipeScopeType === "BASE"
        ? { type: "BASE" as const }
        : { type: recipeScopeType, id: recipeScopeId };
    const result = await saveRecipe(recipeMenuId, ingredientsForRecipe, scope);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Recipe saved. Stock is deducted once when Kitchen marks an order Ready.");
      await refresh();
    }
  };

  const handleStockCount = async (ingredient: Ingredient) => {
    const actual = window.prompt(
      `Physical quantity counted for ${ingredient.name} (${ingredient.unit})`,
      String(ingredient.quantityOnHand)
    );
    if (actual === null) return;
    const actualQuantity = Number(actual);
    if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
      toast.error("Enter a valid non-negative quantity.");
      return;
    }
    const difference = actualQuantity - Number(ingredient.quantityOnHand);
    const reason = window.prompt(
      `Difference: ${difference >= 0 ? "+" : ""}${difference} ${ingredient.unit}. Enter an adjustment reason.`
    );
    if (!reason?.trim()) return;
    if (!window.confirm(`Set ${ingredient.name} stock to ${actualQuantity} ${ingredient.unit}?`)) return;
    const result = await setIngredientStockCount({
      ingredientId: ingredient.id,
      actualQuantity,
      reason,
    });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Physical stock count recorded");
      await refresh();
    }
  };

  const handleIngredientActive = async (ingredient: Ingredient) => {
    const result = await setIngredientActive(ingredient.id, !ingredient.isActive);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(ingredient.isActive ? "Ingredient deactivated" : "Ingredient reactivated");
      await refresh();
    }
  };

  const handleExpiredBatch = async (batchId: string) => {
    const reason = window.prompt("Reason for recording expired stock as wastage");
    if (!reason?.trim()) return;
    const result = await recordExpiredBatchWastage(batchId, reason);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Expired stock recorded as wastage");
      await refresh();
    }
  };

  const handlePurchaseRequest = async () => {
    const items = requestLines
      .filter((line) => line.ingredientId && Number(line.quantity) > 0)
      .map((line) => ({ ingredientId: line.ingredientId, quantity: Number(line.quantity) }));
    if (!items.length) {
      toast.error("Add at least one ingredient to request.");
      return;
    }
    const result = await createPurchaseRequest({ items, notes: requestNotes });
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(`Purchase request ${result.requestNumber} submitted`);
      setRequestLines([{ ingredientId: "", quantity: "" }]);
      setRequestNotes("");
      await refresh();
    }
  };

  const handleExportReport = async () => {
    try {
      const result = await getInventoryReportData({
        report: reportType,
        ...(reportFrom ? { from: reportFrom } : {}),
        ...(reportTo ? { to: reportTo } : {}),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const rows = result.rows;
      if (!rows.length) {
        toast.info("No records found for this report.");
        return;
      }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          Object.values(row)
            .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
            .join(",")
        ),
      ].join("\r\n");
      const link = document.createElement("a");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      link.href = url;
      link.download = `inventory-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export this inventory report.");
    }
  };

  return (
    <main>
      <StaffHeader title="Inventory" subtitle="Ingredients, stock movements, and menu recipes" role="INVENTORY_MANAGER" />
      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Ingredients" value={activeIngredients.length} />
          <Stat label="Low stock" value={lowStock} />
          <Stat label="Estimated stock value" value={formatCurrency(totalStockValue)} />
        </section>

        {lowStockNotifications.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <h2 className="font-semibold">Low-stock notifications</h2>
              {lowStockNotifications.slice(0, 10).map((notification) => {
                const resolved = notification.message.startsWith("Resolved:");
                const message = notification.message
                  .replace(/^Resolved:\s*/, "")
                  .replace(/^\[ingredient:[^\]]+\]\s*/, "")
                  .replace(/\s+\[ingredient:[^\]]+\]$/, "");
                return (
                  <div key={notification.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-muted-foreground">{message}</p>
                    </div>
                    <Badge variant={resolved ? "secondary" : "destructive"}>
                      {resolved ? "Resolved" : notification.isRead ? "Acknowledged — still low" : "Active"}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {userRole === Role.RESTAURANT_OWNER && (
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="ingredient-category">New ingredient category</Label>
                <Input id="ingredient-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
              </div>
              <Button onClick={() => void handleCreateCategory()} disabled={!newCategory.trim()}>Add category</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-lg font-semibold">Add Ingredient</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add an ingredient and its current stock. You can optionally group it with a category.
              </p>
            </div>
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleSaveIngredient}>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-name">Ingredient name</Label>
                <Input id="ingredient-name" placeholder="e.g. Paneer" value={ingredientForm.name} onChange={(event) => setIngredientForm({ ...ingredientForm, name: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-unit">Unit</Label>
                <Input id="ingredient-unit" placeholder="e.g. kg, L, pcs" value={ingredientForm.unit} onChange={(event) => setIngredientForm({ ...ingredientForm, unit: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-opening-stock">Opening stock</Label>
                <Input id="ingredient-opening-stock" type="number" min="0" step="0.001" placeholder="Quantity currently in stock" value={ingredientForm.quantityOnHand} onChange={(event) => setIngredientForm({ ...ingredientForm, quantityOnHand: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-minimum-stock">Low-stock alert level</Label>
                <Input id="ingredient-minimum-stock" type="number" min="0" step="0.001" placeholder="Alert when stock reaches this amount" value={ingredientForm.minimumQuantity} onChange={(event) => setIngredientForm({ ...ingredientForm, minimumQuantity: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-unit-cost">Cost per unit</Label>
                <Input id="ingredient-unit-cost" type="number" min="0" step="0.01" placeholder="Cost for one unit" value={ingredientForm.unitCost} onChange={(event) => setIngredientForm({ ...ingredientForm, unitCost: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-category-select">Category (optional)</Label>
                <select id="ingredient-category-select" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ingredientForm.categoryId} onChange={(event) => setIngredientForm({ ...ingredientForm, categoryId: event.target.value })}>
                  <option value="">No category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-batch-number">Batch number (optional)</Label>
                <Input id="ingredient-batch-number" value={ingredientForm.batchNumber} onChange={(event) => setIngredientForm({ ...ingredientForm, batchNumber: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-expires-at">Expiry date (optional)</Label>
                <Input id="ingredient-expires-at" type="date" value={ingredientForm.expiresAt} onChange={(event) => setIngredientForm({ ...ingredientForm, expiresAt: event.target.value })} />
              </div>
              <Button className="sm:col-span-2 lg:col-span-3" type="submit">Save ingredient to inventory</Button>
            </form>
          </CardContent>
        </Card>

        {expiringBatches.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <h2 className="font-semibold">Expiry alerts (next 7 days and expired)</h2>
              {expiringBatches.map(({ ingredient, batch }) => {
                const expired = Boolean(batch.expiresAt && new Date(batch.expiresAt) <= new Date());
                return (
                  <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>{ingredient.name} · {Number(batch.quantityOnHand)} {ingredient.unit} · {batch.batchNumber || "Unlabeled batch"} · {batch.expiresAt ? formatDate(batch.expiresAt) : ""}</span>
                    <Badge variant={expired ? "destructive" : "secondary"}>{expired ? "Expired — not used in recipes" : "Expiring soon"}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">Current Stock</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                aria-label="Search ingredients"
                placeholder="Search ingredients"
                value={ingredientSearch}
                onChange={(event) => setIngredientSearch(event.target.value)}
              />
              <select
                aria-label="Filter by category"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select
                aria-label="Filter by stock status"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}
              >
                <option value="ALL">All stock</option>
                <option value="LOW">Low stock</option>
                <option value="IN_STOCK">In stock</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading inventory…</p> : ingredients.length === 0 ? <p className="text-sm text-muted-foreground">No ingredients recorded yet.</p> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredIngredients.map((ingredient) => {
                const isLow = ingredient.isActive && Number(ingredient.quantityOnHand) <= Number(ingredient.minimumQuantity);
                return (
                  <Card key={ingredient.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium">{ingredient.name}</h3>
                          <p className="text-xs text-muted-foreground">{ingredient.category?.name ?? "Uncategorized"}</p>
                        </div>
                        <div className="flex gap-1">
                          {!ingredient.isActive && <Badge variant="secondary">Inactive</Badge>}
                          {ingredient.isActive && <Badge variant={isLow ? "destructive" : "secondary"}>{isLow ? "Low stock" : "In stock"}</Badge>}
                        </div>
                      </div>
                      <p className="text-2xl font-semibold">{Number(ingredient.quantityOnHand)} <span className="text-sm font-normal text-muted-foreground">{ingredient.unit}</span></p>
                      <p className="text-xs text-muted-foreground">Minimum {Number(ingredient.minimumQuantity)} {ingredient.unit} · Unit cost {formatCurrency(ingredient.unitCost)}</p>
                      <p className="text-xs text-muted-foreground">
                        Used by: {menuItems.filter((item) => item.recipeItems.some((recipe) => recipe.ingredientId === ingredient.id)).map((item) => item.name).join(", ") || "No menu recipes"}
                      </p>
                      {ingredient.batches.length > 0 && (
                        <div className="space-y-1 border-t pt-2">
                          {ingredient.batches.map((batch) => {
                            const expired = Boolean(batch.expiresAt && new Date(batch.expiresAt) <= new Date());
                            return (
                              <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span>
                                  {batch.batchNumber || "Unlabeled batch"} · {Number(batch.quantityOnHand)} {ingredient.unit}
                                  {batch.expiresAt ? ` · Expires ${formatDate(batch.expiresAt)}` : ""}
                                </span>
                                {expired && (
                                  <Button size="sm" variant="outline" onClick={() => void handleExpiredBatch(batch.id)}>
                                    Record expired wastage
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {ingredient.isActive && (
                        <>
                          <Input aria-label={`Quantity adjustment for ${ingredient.name}`} type="number" min="0.001" step="0.001" placeholder="Quantity" value={adjustments[ingredient.id] ?? ""} onChange={(event) => setAdjustments((current) => ({ ...current, [ingredient.id]: event.target.value }))} />
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" onClick={() => void handleAdjustment(ingredient, "ADJUSTMENT")}>Add stock</Button>
                            <Button variant="outline" onClick={() => void handleAdjustment(ingredient, "WASTAGE")}>Record wastage</Button>
                          </div>
                          <Button variant="outline" className="w-full" onClick={() => void handleStockCount(ingredient)}>Set physical stock count</Button>
                        </>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setHistoryIngredientId(historyIngredientId === ingredient.id ? "" : ingredient.id)}>
                          {historyIngredientId === ingredient.id ? "Hide history" : "Stock history"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleIngredientActive(ingredient)}>
                          {ingredient.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                      {historyIngredientId === ingredient.id && (
                        <div className="max-h-56 space-y-2 overflow-y-auto border-t pt-2">
                          {isHistoryLoading ? <p className="text-xs text-muted-foreground">Loading stock history…</p> : isHistoryError ? <p className="text-xs text-destructive">{historyQueryError instanceof Error ? historyQueryError.message : "Could not load stock history."}</p> : historyMovements.length === 0 ? <p className="text-xs text-muted-foreground">No stock movements.</p> : historyMovements.map((movement) => (
                            <div key={movement.id} className="flex justify-between gap-2 text-xs">
                              <span>{movement.type} · {movement.reason ?? "—"}{movement.batch?.batchNumber ? ` · ${movement.batch.batchNumber}` : ""}</span>
                              <span>{Number(movement.quantity)} {ingredient.unit} · {formatDate(movement.createdAt)}</span>
                            </div>
                          ))}
                          {historyData && !Array.isArray(historyData) && "error" in historyData && (
                            <p className="text-xs text-destructive">{historyData.error}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {filteredIngredients.length === 0 && <p className="text-sm text-muted-foreground">No ingredients match these filters.</p>}
            </div>
          )}
        </section>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <h2 className="text-lg font-semibold">Menu Recipes</h2>
              <p className="text-sm text-muted-foreground">
                Review, edit, and save base, variant, or add-on recipes. Ingredients are deducted transactionally when Kitchen marks an order Ready, once per order.
              </p>
            </div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={recipeMenuId}
              onChange={(event) => {
                setRecipeMenuId(event.target.value);
                setRecipeScopeType("BASE");
                setRecipeScopeId("");
              }}
            >
              <option value="">Select a menu item</option>
              {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {recipeMenuId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Recipe applies to</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={recipeScopeType}
                    onChange={(event) => {
                      setRecipeScopeType(event.target.value as typeof recipeScopeType);
                      setRecipeScopeId("");
                    }}
                  >
                    <option value="BASE">Base menu item</option>
                    <option value="VARIANT">Menu variant</option>
                    <option value="ADDON">Add-on</option>
                  </select>
                </div>
                {recipeScopeType !== "BASE" && (
                  <div className="space-y-1">
                    <Label>{recipeScopeType === "VARIANT" ? "Variant" : "Add-on"}</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={recipeScopeId}
                      onChange={(event) => setRecipeScopeId(event.target.value)}
                    >
                      <option value="">Select {recipeScopeType === "VARIANT" ? "variant" : "add-on"}</option>
                      {recipeScopeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            {selectedRecipeItems.length > 0 && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Saved recipe details</p>
                <p>
                  Estimated cost per serving: {formatCurrency(selectedRecipeItems.reduce(
                    (sum, line) => sum + Number(line.quantity) * Number(line.ingredient.unitCost),
                    0
                  ))}
                </p>
                <p className="text-muted-foreground">
                  {selectedRecipeItems.every((line) => line.ingredient.isActive && Number(line.ingredient.quantityOnHand) >= Number(line.quantity))
                    ? "Ingredients are available for one serving."
                    : "One or more ingredients are inactive or below one serving's requirement."}
                </p>
              </div>
            )}
            {recipeLines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={line.ingredientId} onChange={(event) => setRecipeLines((current) => current.map((entry, i) => i === index ? { ...entry, ingredientId: event.target.value } : entry))}>
                  <option value="">Select ingredient</option>
                  {activeIngredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                </select>
                <Input type="number" min="0.001" step="0.001" placeholder="Qty per item" value={line.quantity} onChange={(event) => setRecipeLines((current) => current.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} />
                <Button type="button" variant="outline" onClick={() => setRecipeLines((current) => current.length === 1 ? current : current.filter((_, i) => i !== index))}>Remove</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setRecipeLines((current) => [...current, { ingredientId: "", quantity: "" }])}>Add ingredient</Button>
              {userRole === Role.RESTAURANT_OWNER && <Button type="button" onClick={() => void handleSaveRecipe()} disabled={!recipeMenuId || (recipeScopeType !== "BASE" && !recipeScopeId)}>Save recipe</Button>}
            </div>
            <div className="space-y-2 border-t pt-3">
              <h3 className="font-medium">Recipe coverage, cost, and availability</h3>
              {menuItems.map((item) => {
                const baseRecipe = item.recipeItems.filter((line) => !line.variantId && !line.addonId);
                const groups = [
                  { label: "Base", lines: baseRecipe },
                  ...item.variants.map((variant) => ({
                    label: `Variant: ${variant.name}`,
                    lines: item.recipeItems.filter((line) => line.variantId === variant.id),
                  })),
                  ...item.addons.map((addon) => ({
                    label: `Add-on: ${addon.name}`,
                    lines: item.recipeItems.filter((line) => line.addonId === addon.id),
                  })),
                ].filter((group) => group.lines.length > 0);
                return (
                  <div key={item.id} className="space-y-1 border-b pb-2 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{item.name}</strong>
                      {baseRecipe.length === 0 && <Badge variant="destructive">Base recipe missing</Badge>}
                      {item.recipeItems.length === 0 && <span className="text-xs text-muted-foreground">No recipe has been saved for this menu item.</span>}
                    </div>
                    {groups.map((group) => {
                      const cost = group.lines.reduce(
                        (sum, line) => sum + Number(line.quantity) * Number(line.ingredient.unitCost),
                        0
                      );
                      const available = group.lines.every(
                        (line) => line.ingredient.isActive &&
                          Number(line.ingredient.quantityOnHand) >= Number(line.quantity)
                      );
                      return (
                        <div key={`${item.id}-${group.label}`} className="pl-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{group.label}</span>
                          {" · "}{group.lines.map((line) => `${line.ingredient.name} ${Number(line.quantity)} ${line.ingredient.unit}`).join(", ")}
                          {" · Cost "}{formatCurrency(cost)}
                          {" · "}{available ? "Available for one serving" : "Insufficient or inactive ingredient"}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {(userRole === Role.INVENTORY_MANAGER || userRole === Role.RESTAURANT_OWNER) && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h2 className="text-lg font-semibold">Purchase Requests</h2>
                <p className="text-sm text-muted-foreground">
                  Submit ingredients needed by the kitchen. Requests do not change stock; the Purchase Manager converts them into the existing purchase-order workflow.
                </p>
              </div>
              {requestLines.map((line, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={line.ingredientId}
                    onChange={(event) => setRequestLines((current) => current.map((entry, row) =>
                      row === index ? { ...entry, ingredientId: event.target.value } : entry
                    ))}
                  >
                    <option value="">Select ingredient</option>
                    {activeIngredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                  </select>
                  <Input
                    aria-label="Requested quantity"
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="Requested quantity"
                    value={line.quantity}
                    onChange={(event) => setRequestLines((current) => current.map((entry, row) =>
                      row === index ? { ...entry, quantity: event.target.value } : entry
                    ))}
                  />
                  <Button type="button" variant="outline" onClick={() => setRequestLines((current) =>
                    current.length === 1 ? current : current.filter((_, row) => row !== index)
                  )}>Remove</Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setRequestLines((current) => [...current, { ingredientId: "", quantity: "" }])}>Add ingredient</Button>
                <Input aria-label="Purchase request notes" placeholder="Notes (optional)" value={requestNotes} onChange={(event) => setRequestNotes(event.target.value)} />
                <Button type="button" onClick={() => void handlePurchaseRequest()}>Submit purchase request</Button>
              </div>
              <div className="space-y-2 border-t pt-3">
                <h3 className="font-medium">Request status</h3>
                {purchaseRequests.length === 0 ? <p className="text-sm text-muted-foreground">No requests submitted.</p> : purchaseRequests.map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                    <span>
                      <strong>{request.requestNumber}</strong> · {request.status.replaceAll("_", " ")} · {request.items.map((item) => `${item.ingredient.name} ${Number(item.quantity)} ${item.ingredient.unit}`).join(", ")}
                      {request.purchaseOrder ? ` · ${request.purchaseOrder.purchaseNumber}` : ""}
                      {request.purchaseOrder?.expectedDeliveryAt ? ` · Expected ${formatDate(request.purchaseOrder.expectedDeliveryAt)}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(request.createdAt)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <h2 className="text-lg font-semibold">Inventory Reports</h2>
              <p className="text-sm text-muted-foreground">Export current stock, low stock, ingredient consumption, wastage, or purchase history as CSV.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={reportType}
                onChange={(event) => setReportType(event.target.value as typeof reportType)}
              >
                <option value="current-stock">Current stock</option>
                <option value="low-stock">Low-stock ingredients</option>
                <option value="consumption">Ingredient consumption</option>
                <option value="wastage">Wastage</option>
                <option value="purchase-history">Purchase history</option>
              </select>
              <Input aria-label="Report start date" type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
              <Input aria-label="Report end date" type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
              <Button type="button" onClick={() => void handleExportReport()}>Export CSV</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Recent Stock Movements</h2>
            {movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements recorded.</p> : (
              <div className="space-y-2">
                {movements.map((movement) => (
                  <div key={movement.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 text-sm last:border-0">
                    <span>{movement.ingredient.name} · {movement.type} · {movement.reason ?? "—"}</span>
                    <span>{Number(movement.quantity)} {movement.ingredient.unit} · {formatDate(movement.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>;
}
