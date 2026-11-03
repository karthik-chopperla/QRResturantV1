"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Role } from "@prisma/client";
import {
  adjustIngredientStock,
  createIngredientCategory,
  getInventoryData,
  saveIngredient,
  saveRecipe,
} from "@/actions/inventory";
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
  });
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [recipeMenuId, setRecipeMenuId] = useState("");
  const [recipeLines, setRecipeLines] = useState([
    { ingredientId: "", quantity: "" },
  ]);

  useEffect(() => {
    void getCurrentUser().then((user) => setUserRole(user?.role ?? null));
  }, []);

  const ingredients = data && "ingredients" in data ? data.ingredients ?? [] : [];
  const categories = data && "categories" in data ? data.categories ?? [] : [];
  const movements = data && "movements" in data ? data.movements ?? [] : [];
  const menuItems = data && "menuItems" in data ? data.menuItems ?? [] : [];
  const lowStock = ingredients.filter(
    (ingredient) => Number(ingredient.quantityOnHand) <= Number(ingredient.minimumQuantity)
  ).length;
  const totalStockValue = ingredients.reduce(
    (sum, ingredient) =>
      sum + Number(ingredient.quantityOnHand) * Number(ingredient.unitCost),
    0
  );

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
    const result = await adjustIngredientStock({
      ingredientId: ingredient.id,
      quantity,
      type,
      reason,
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
    const result = await saveRecipe(recipeMenuId, ingredientsForRecipe);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Recipe saved. Stock is deducted once when an order enters preparation.");
      setRecipeLines([{ ingredientId: "", quantity: "" }]);
    }
  };

  return (
    <main>
      <StaffHeader title="Inventory" subtitle="Ingredients, stock movements, and menu recipes" role="INVENTORY_MANAGER" />
      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Ingredients" value={ingredients.length} />
          <Stat label="Low stock" value={lowStock} />
          <Stat label="Estimated stock value" value={formatCurrency(totalStockValue)} />
        </section>

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
              <Button className="sm:col-span-2 lg:col-span-3" type="submit">Save ingredient to inventory</Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Current Stock</h2>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading inventory…</p> : ingredients.length === 0 ? <p className="text-sm text-muted-foreground">No ingredients recorded yet.</p> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ingredients.map((ingredient) => {
                const isLow = Number(ingredient.quantityOnHand) <= Number(ingredient.minimumQuantity);
                return (
                  <Card key={ingredient.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium">{ingredient.name}</h3>
                          <p className="text-xs text-muted-foreground">{ingredient.category?.name ?? "Uncategorized"}</p>
                        </div>
                        <Badge variant={isLow ? "destructive" : "secondary"}>{isLow ? "Low stock" : "In stock"}</Badge>
                      </div>
                      <p className="text-2xl font-semibold">{Number(ingredient.quantityOnHand)} <span className="text-sm font-normal text-muted-foreground">{ingredient.unit}</span></p>
                      <p className="text-xs text-muted-foreground">Minimum {Number(ingredient.minimumQuantity)} {ingredient.unit} · Unit cost {formatCurrency(ingredient.unitCost)}</p>
                      {ingredient.expiresAt && <p className="text-xs text-muted-foreground">Expires {formatDate(ingredient.expiresAt)}</p>}
                      <Input aria-label={`Quantity adjustment for ${ingredient.name}`} type="number" min="0.001" step="0.001" placeholder="Quantity" value={adjustments[ingredient.id] ?? ""} onChange={(event) => setAdjustments((current) => ({ ...current, [ingredient.id]: event.target.value }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => void handleAdjustment(ingredient, "ADJUSTMENT")}>Add stock</Button>
                        <Button variant="outline" onClick={() => void handleAdjustment(ingredient, "WASTAGE")}>Record wastage</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <h2 className="text-lg font-semibold">Menu Recipes</h2>
              <p className="text-sm text-muted-foreground">Define ingredient quantities per menu item. Stock deduction happens transactionally at the first preparation transition, once per order.</p>
            </div>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={recipeMenuId} onChange={(event) => setRecipeMenuId(event.target.value)}>
              <option value="">Select a menu item</option>
              {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {recipeLines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={line.ingredientId} onChange={(event) => setRecipeLines((current) => current.map((entry, i) => i === index ? { ...entry, ingredientId: event.target.value } : entry))}>
                  <option value="">Select ingredient</option>
                  {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                </select>
                <Input type="number" min="0.001" step="0.001" placeholder="Qty per item" value={line.quantity} onChange={(event) => setRecipeLines((current) => current.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} />
                <Button type="button" variant="outline" onClick={() => setRecipeLines((current) => current.length === 1 ? current : current.filter((_, i) => i !== index))}>Remove</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setRecipeLines((current) => [...current, { ingredientId: "", quantity: "" }])}>Add ingredient</Button>
              {userRole === Role.RESTAURANT_OWNER && <Button type="button" onClick={() => void handleSaveRecipe()}>Save recipe</Button>}
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
