"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  /** Current image URLs already saved (from the database) */
  value: string[];
  /** Called with the new array of URLs after each add/remove */
  onChange: (urls: string[]) => void;
  /** Maximum number of images allowed. Defaults to 5 */
  maxImages?: number;
  className?: string;
}

interface UploadingFile {
  id: string;
  name: string;
  /** 0-100 */
  progress: number;
  error?: string;
  /** Object URL for preview while uploading */
  previewUrl: string;
}

export function ImageUpload({
  value,
  onChange,
  maxImages = 5,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const canAddMore = value.length + uploading.length < maxImages;

  /** Upload a single File, returning the public URL or throwing */
  const uploadFile = async (
    file: File,
    onProgress: (p: number) => void
  ): Promise<string> => {
    onProgress(10);

    const formData = new FormData();
    formData.append("file", file);

    // Use XMLHttpRequest so we can track real upload progress
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 90));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.url) {
              onProgress(100);
              resolve(data.url);
            } else {
              reject(new Error(data.error || "Upload failed"));
            }
          } catch {
            reject(new Error("Invalid server response"));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    });
  };

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const allowed = maxImages - value.length - uploading.length;
      const toProcess = fileArray.slice(0, Math.max(0, allowed));
      if (toProcess.length === 0) return;

      // Create upload entries immediately so previews appear
      const entries: UploadingFile[] = toProcess.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        progress: 0,
        previewUrl: URL.createObjectURL(file),
      }));

      setUploading((prev) => [...prev, ...entries]);

      // Upload in parallel
      await Promise.all(
        toProcess.map(async (file, i) => {
          const entry = entries[i];
          try {
            const url = await uploadFile(file, (progress) => {
              setUploading((prev) =>
                prev.map((u) => (u.id === entry.id ? { ...u, progress } : u))
              );
            });

            // Success — move from uploading to value
            setUploading((prev) => prev.filter((u) => u.id !== entry.id));
            URL.revokeObjectURL(entry.previewUrl);
            onChange([...value, url]);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Upload failed";
            setUploading((prev) =>
              prev.map((u) =>
                u.id === entry.id ? { ...u, error: message } : u
              )
            );
          }
        })
      );
    },
    [maxImages, value, uploading.length, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input so the same file can be picked again after removal
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeExisting = (url: string) => {
    onChange(value.filter((u) => u !== url));
  };

  const dismissError = (id: string) => {
    setUploading((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Existing + in-progress images grid */}
      {(value.length > 0 || uploading.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {/* Saved images */}
          {value.map((url) => (
            <div key={url} className="group relative size-20 overflow-hidden rounded-lg border border-border">
              <Image
                src={url}
                alt="Menu item image"
                fill
                className="object-cover"
                sizes="80px"
              />
              <button
                type="button"
                onClick={() => removeExisting(url)}
                className="absolute right-1 top-1 hidden rounded-full bg-destructive/90 p-0.5 text-destructive-foreground group-hover:flex"
                aria-label="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {/* In-progress uploads */}
          {uploading.map((u) => (
            <div
              key={u.id}
              className="relative size-20 overflow-hidden rounded-lg border border-border"
            >
              {u.error ? (
                // Error state
                <div className="flex h-full flex-col items-center justify-center gap-1 bg-red-50 p-1 text-center">
                  <X className="size-4 text-red-600" />
                  <p className="text-[9px] leading-tight text-red-600 line-clamp-2">
                    {u.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismissError(u.id)}
                    className="mt-0.5 rounded text-[9px] text-muted-foreground underline"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                // Progress overlay on top of preview
                <>
                  <Image
                    src={u.previewUrl}
                    alt={u.name}
                    fill
                    className="object-cover opacity-60"
                    sizes="80px"
                    unoptimized // blob URL, skip Next.js optimizer
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60">
                    <Loader2 className="size-5 animate-spin text-primary" />
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-200"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone / add-more button */}
      {canAddMore && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          aria-label="Upload images"
        >
          {uploading.some((u) => !u.error) ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ImagePlus className="size-5" />
                <Upload className="size-4" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {value.length === 0 ? "Upload images" : "Add more"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Drag &amp; drop or click · JPG, PNG, WebP, GIF · max 5 MB
                </p>
                <p className="text-xs text-muted-foreground">
                  {value.length}/{maxImages} images
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="sr-only"
        onChange={handleInputChange}
        tabIndex={-1}
      />
    </div>
  );
}
