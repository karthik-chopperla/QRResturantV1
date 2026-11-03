DO $$ BEGIN
    CREATE TYPE "PurchaseRequestStatus" AS ENUM (
        'PENDING',
        'PO_SUBMITTED',
        'APPROVED',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Ingredient"
    ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
DROP INDEX IF EXISTS "Ingredient_quantityOnHand_minimumQuantity_idx";
CREATE INDEX IF NOT EXISTS "Ingredient_isActive_quantityOnHand_minimumQuantity_idx"
    ON "Ingredient"("isActive", "quantityOnHand", "minimumQuantity");

CREATE TABLE IF NOT EXISTS "IngredientBatch" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantityReceived" DECIMAL(12,3) NOT NULL,
    "quantityOnHand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IngredientBatch_pkey" PRIMARY KEY ("id")
);

INSERT INTO "IngredientBatch" (
    "id", "ingredientId", "batchNumber", "quantityReceived", "quantityOnHand",
    "unitCost", "expiresAt", "receivedAt", "createdAt", "updatedAt"
)
SELECT
    'opening-' || "id", "id", 'Opening stock', "quantityOnHand", "quantityOnHand",
    "unitCost", "expiresAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Ingredient"
WHERE "quantityOnHand" > 0
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX IF NOT EXISTS "IngredientBatch_ingredientId_expiresAt_quantityOnHand_idx"
    ON "IngredientBatch"("ingredientId", "expiresAt", "quantityOnHand");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IngredientBatch_ingredientId_fkey') THEN
        ALTER TABLE "IngredientBatch"
            ADD CONSTRAINT "IngredientBatch_ingredientId_fkey"
            FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "batchId" TEXT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_batchId_fkey') THEN
        ALTER TABLE "StockMovement"
            ADD CONSTRAINT "StockMovement_batchId_fkey"
            FOREIGN KEY ("batchId") REFERENCES "IngredientBatch"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "PurchaseReceiptItem"
    ADD COLUMN IF NOT EXISTS "batchId" TEXT,
    ADD COLUMN IF NOT EXISTS "batchNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseReceiptItem_batchId_fkey') THEN
        ALTER TABLE "PurchaseReceiptItem"
            ADD CONSTRAINT "PurchaseReceiptItem_batchId_fkey"
            FOREIGN KEY ("batchId") REFERENCES "IngredientBatch"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "RecipeIngredient"
    ADD COLUMN IF NOT EXISTS "variantId" TEXT,
    ADD COLUMN IF NOT EXISTS "addonId" TEXT;
DROP INDEX IF EXISTS "RecipeIngredient_menuItemId_ingredientId_key";
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecipeIngredient_variantId_fkey') THEN
        ALTER TABLE "RecipeIngredient"
            ADD CONSTRAINT "RecipeIngredient_variantId_fkey"
            FOREIGN KEY ("variantId") REFERENCES "Variant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecipeIngredient_addonId_fkey') THEN
        ALTER TABLE "RecipeIngredient"
            ADD CONSTRAINT "RecipeIngredient_addonId_fkey"
            FOREIGN KEY ("addonId") REFERENCES "Addon"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecipeIngredient_single_scope_check') THEN
        ALTER TABLE "RecipeIngredient"
            ADD CONSTRAINT "RecipeIngredient_single_scope_check"
            CHECK ("variantId" IS NULL OR "addonId" IS NULL);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "RecipeIngredient_menuItemId_variantId_addonId_idx"
    ON "RecipeIngredient"("menuItemId", "variantId", "addonId");
CREATE INDEX IF NOT EXISTS "RecipeIngredient_ingredientId_idx"
    ON "RecipeIngredient"("ingredientId");
CREATE UNIQUE INDEX IF NOT EXISTS "RecipeIngredient_base_unique"
    ON "RecipeIngredient"("menuItemId", "ingredientId")
    WHERE "variantId" IS NULL AND "addonId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "RecipeIngredient_variant_unique"
    ON "RecipeIngredient"("variantId", "ingredientId")
    WHERE "variantId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "RecipeIngredient_addon_unique"
    ON "RecipeIngredient"("addonId", "ingredientId")
    WHERE "addonId" IS NOT NULL;

ALTER TABLE "PurchaseOrder"
    ADD COLUMN IF NOT EXISTS "purchaseRequestId" TEXT,
    ADD COLUMN IF NOT EXISTS "expectedDeliveryAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_purchaseRequestId_key"
    ON "PurchaseOrder"("purchaseRequestId");

CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequest_requestNumber_key"
    ON "PurchaseRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_status_createdAt_idx"
    ON "PurchaseRequest"("status", "createdAt");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_purchaseRequestId_fkey') THEN
        ALTER TABLE "PurchaseOrder"
            ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey"
            FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequestItem_requestId_ingredientId_key"
    ON "PurchaseRequestItem"("requestId", "ingredientId");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequestItem_requestId_fkey') THEN
        ALTER TABLE "PurchaseRequestItem"
            ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey"
            FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequestItem_ingredientId_fkey') THEN
        ALTER TABLE "PurchaseRequestItem"
            ADD CONSTRAINT "PurchaseRequestItem_ingredientId_fkey"
            FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
