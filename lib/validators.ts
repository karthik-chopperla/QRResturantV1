import { menuScanResponseSchema, type MenuScanResponseInput } from "./menu-schema";

const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const COMPRESS_THRESHOLD = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ACCEPTED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a PNG, JPG, or JPEG image.",
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }
  return { valid: true };
}

export function needsCompression(file: File): boolean {
  return file.size > COMPRESS_THRESHOLD;
}

export function validateGeminiResponse(raw: unknown): {
  valid: boolean;
  data?: MenuScanResponseInput;
  error?: string;
} {
  const result = menuScanResponseSchema.safeParse(raw);
  if (!result.success) {
    return {
      valid: false,
      error: `Invalid AI response: ${result.error.issues.map((i) => i.message).join(", ")}`,
    };
  }
  if (result.data.items.length === 0) {
    return {
      valid: false,
      error: "No menu items were found in the image. Please try a clearer photo.",
    };
  }
  return { valid: true, data: result.data };
}

export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 1600;
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
