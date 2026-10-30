"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategories } from "@/actions/categories";
import { useMenuImport } from "@/hooks/use-menu-import";
import { UploadMenu } from "./upload-menu";
import { PreviewTable } from "./preview-table";
import { BulkCategorySelect } from "./bulk-category-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
  ScanLine,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { generateMenuImages } from "@/actions/generate-menu-images";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const queryClient = useQueryClient();

  const {
    step,
    previewUrl,
    items,
    scanning,
    saving,
    error,
    importedCount,
    selectedCount,
    allSelected,
    handleFileSelect,
    updateItem,
    toggleItem,
    toggleAll,
    setBulkCategory,
    handleImport,
    reset,
  } = useMenuImport();

  const [generatingImages, setGeneratingImages] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    enabled: open,
  });

  const handleClose = useCallback(
    (o: boolean) => {
      if (!o) {
        if (step === "done") {
          queryClient.invalidateQueries({ queryKey: ["menuItems"] });
          queryClient.invalidateQueries({ queryKey: ["categories"] });
        }
        setTimeout(() => reset(), 200);
      }
      onOpenChange(o);
    },
    [onOpenChange, reset, step, queryClient]
  );

  useEffect(() => {
    if (step === "done" && importedCount > 0) {
      toast.success(`Successfully imported ${importedCount} menu items.`);
    }
  }, [step, importedCount]);

  const handleGenerateImages = useCallback(async () => {
    const selectedItems = items.filter((i) => i.selected && !i.imageUrl);
    if (selectedItems.length === 0) {
      toast.info("No items need images.");
      return;
    }

    setGeneratingImages(true);
    toast.info(`Finding images for ${selectedItems.length} items...`);

    try {
      const result = await generateMenuImages(
        selectedItems.map((i) => i.name)
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      let foundCount = 0;
      for (const { dishName, imageUrl } of result.results) {
        if (imageUrl) {
          const item = items.find(
            (i) => i.name === dishName && i.selected && !i.imageUrl
          );
          if (item) {
            updateItem(item.id, { imageUrl });
            foundCount++;
          }
        }
      }

      if (foundCount > 0) {
        toast.success(`Found images for ${foundCount} items.`);
      } else {
        toast.warning("Could not find images for any items.");
      }
    } catch (err) {
      toast.error("Failed to generate images. Please try again.");
    } finally {
      setGeneratingImages(false);
    }
  }, [items, updateItem]);

  const hasMissingCategories =
    step === "preview" &&
    !scanning &&
    items.some((i) => i.selected && !i.categoryId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-none sm:rounded-2xl">
        {/* ── Header ── */}
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-5 sm:pt-5 shrink-0">
          <DialogTitle className="flex items-center gap-2 font-extrabold text-base">
            {step === "upload" && (
              <>
                <ScanLine className="size-5 text-blue-500" />
                AI Menu Scanner
              </>
            )}
            {step === "preview" && scanning && (
              <>
                <div className="size-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Scanning Menu...
              </>
            )}
            {step === "preview" && !scanning && (
              <>
                <Sparkles className="size-5 text-blue-500" />
                Review Extracted Items
              </>
            )}
            {step === "done" && (
              <>
                <CheckCircle2 className="size-5 text-green-500" />
                Import Complete
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-4">
              <UploadMenu onFileSelect={handleFileSelect} scanning={scanning} />
              {error && <ErrorBanner message={error} />}
            </div>
          )}

          {/* Scanning State */}
          {step === "preview" && scanning && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {previewUrl && (
                <div className="relative w-48 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 opacity-60">
                  <img
                    src={previewUrl}
                    alt="Menu being scanned"
                    className="w-full object-contain"
                  />
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  AI is extracting menu items...
                </p>
                <p className="text-xs text-gray-500">
                  This usually takes a few seconds
                </p>
              </div>
            </div>
          )}

          {/* Items Found */}
          {step === "preview" && !scanning && items.length > 0 && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={reset}
                    className="text-xs font-bold h-7"
                  >
                    <ArrowLeft className="mr-1 size-3" />
                    New Image
                  </Button>
                  <span className="text-xs text-gray-500">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {items.length}
                    </span>{" "}
                    items
                    {selectedCount < items.length && (
                      <>
                        {" "}&middot;{" "}
                        <span className="font-bold text-blue-600">
                          {selectedCount}
                        </span>{" "}
                        selected
                      </>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <BulkCategorySelect
                    categories={categories}
                    onBulkSelect={setBulkCategory}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateImages}
                    disabled={generatingImages || selectedCount === 0}
                    className="text-xs font-bold h-7"
                  >
                    {generatingImages ? (
                      <>
                        <Loader2 className="mr-1 size-3 animate-spin" />
                        Finding Images...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-1 size-3" />
                        Generate Images
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {error && <ErrorBanner message={error} />}

              <PreviewTable
                items={items}
                categories={categories}
                allSelected={allSelected}
                onToggleAll={toggleAll}
                onToggleItem={toggleItem}
                onUpdateItem={updateItem}
              />
            </div>
          )}

          {/* No Items */}
          {step === "preview" && !scanning && items.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="size-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <AlertCircle className="size-6 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  No items found
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  The AI could not detect menu items. Try a clearer, well-lit photo of the menu.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold mt-2"
                onClick={reset}
              >
                <RotateCcw className="mr-1 size-3" />
                Try Again
              </Button>
            </div>
          )}

          {/* Done Step */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="size-16 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
                <CheckCircle2 className="size-8 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                  All Done!
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Successfully imported{" "}
                  <span className="font-bold text-green-600">
                    {importedCount}
                  </span>{" "}
                  menu items into your menu.
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reset}
                  className="text-xs font-bold"
                >
                  <Sparkles className="mr-1 size-3" />
                  Import More
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleClose(false)}
                  className="text-xs font-bold"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step === "preview" && !scanning && items.length > 0 && (
          <div className="px-4 py-3 sm:px-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              {hasMissingCategories ? (
                <p className="text-[11px] text-amber-600 font-medium truncate">
                  Assign a category to all selected items before importing.
                </p>
              ) : (
                <p className="text-[11px] text-gray-400">
                  {selectedCount} item{selectedCount !== 1 ? "s" : ""} will be
                  imported
                </p>
              )}
            </div>
            <Button
              onClick={handleImport}
              disabled={saving || selectedCount === 0 || hasMissingCategories}
              className="text-xs font-bold shrink-0"
              size="sm"
            >
              {saving ? (
                <>
                  <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                  Importing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 size-3" />
                  Import Selected ({selectedCount})
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
      <AlertCircle className="size-4 text-red-500 shrink-0" />
      <p className="text-xs text-red-700 dark:text-red-400 font-medium">
        {message}
      </p>
    </div>
  );
}
