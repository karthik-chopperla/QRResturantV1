"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon, X } from "lucide-react";

interface UploadMenuProps {
  onFileSelect: (file: File) => void;
  scanning: boolean;
}

export function UploadMenu({ onFileSelect, scanning }: UploadMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      setPreview(url);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [processFile]
  );

  const clearPreview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }, [preview]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleChange}
        className="hidden"
      />

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <img
            src={preview}
            alt="Menu preview"
            className="w-full max-h-64 object-contain"
          />
          {!scanning && (
            <button
              onClick={clearPreview}
              className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
          {scanning && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
              <div className="size-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-white">Scanning menu...</p>
            </div>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8
            transition-all duration-200 cursor-pointer
            ${
              dragOver
                ? "border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30"
                : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700"
            }
          `}
        >
          <div
            className={`
              size-12 rounded-full flex items-center justify-center transition-colors
              ${dragOver ? "bg-blue-100 dark:bg-blue-900/50" : "bg-gray-100 dark:bg-gray-800"}
            `}
          >
            <Upload
              className={`size-5 ${dragOver ? "text-blue-500" : "text-gray-400"}`}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {dragOver ? "Drop your menu image here" : "Upload Menu Image"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Drag & drop or click to browse — PNG, JPG up to 10MB
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-bold mt-1"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <ImageIcon className="mr-1.5 size-3.5" />
            Choose Image
          </Button>
        </div>
      )}
    </div>
  );
}
