"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SingleImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  className?: string;
  label?: string;
  aspectRatio?: "square" | "banner";
}

export function SingleImageUpload({
  value,
  onChange,
  className,
  label = "Upload image",
  aspectRatio = "square",
}: SingleImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      if (uploading) return;

      // Validate
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(file.type)) {
        setError("Only JPEG, PNG, WebP, and GIF are allowed.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be under 5 MB.");
        return;
      }

      setUploading(true);
      setProgress(10);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const url = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 90));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.url) {
                  setProgress(100);
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
          xhr.open("POST", "/api/upload/settings");
          xhr.send(formData);
        });

        onChange(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [uploading, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    onChange("");
    setError(null);
  };

  const hasImage = value && value.length > 0;

  return (
    <div className={cn("space-y-2", className)}>
      {hasImage && !uploading && (
        <div
          className={cn(
            "group relative overflow-hidden rounded-lg border border-border",
            aspectRatio === "banner" ? "aspect-[3/1]" : "aspect-square max-w-[140px]"
          )}
        >
          <Image src={value} alt={label} fill className="object-cover" sizes="200px" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-2 top-2 hidden rounded-full bg-destructive/90 p-1 text-destructive-foreground group-hover:flex"
            aria-label="Remove image"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {(uploading || error) && (
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border border-border",
            aspectRatio === "banner" ? "aspect-[3/1]" : "aspect-square max-w-[140px]"
          )}
        >
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 bg-red-50 p-2 text-center">
              <X className="size-4 text-red-600" />
              <p className="text-[10px] leading-tight text-red-600 line-clamp-2">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="mt-1 rounded text-[10px] text-muted-foreground underline"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-background/60">
              <Loader2 className="size-5 animate-spin text-primary" />
              <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!hasImage && !uploading && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 transition-colors",
            aspectRatio === "banner" ? "aspect-[3/1]" : "aspect-square max-w-[140px]",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          aria-label={label}
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ImagePlus className="size-4" />
            <Upload className="size-3.5" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP, GIF · max 5 MB</p>
        </div>
      )}

      {hasImage && !uploading && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border p-1.5 text-xs text-muted-foreground transition-colors",
            dragOver ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/50"
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <Upload className="size-3" />
          Replace
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleInputChange}
        tabIndex={-1}
      />
    </div>
  );
}
