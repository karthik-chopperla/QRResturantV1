import { createClient as createServiceRoleClient } from "@supabase/supabase-js";

export const MENU_IMAGES_BUCKET = "menu-images";
export const SETTINGS_PREFIX = "settings";

/**
 * Service-role Supabase client for server-side storage operations.
 * Never exposed to the browser.
 */
export function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for storage operations."
    );
  }

  return createServiceRoleClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Returns the public URL for a stored menu image path.
 * e.g. "menu-images/abc.jpg" → "https://xxxx.supabase.co/storage/v1/object/public/menu-images/abc.jpg"
 */
export function getPublicUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return `${url}/storage/v1/object/public/${MENU_IMAGES_BUCKET}/${path}`;
}

/**
 * Extracts the storage object path from a full public URL.
 * Returns null if the URL doesn't belong to this bucket.
 */
export function pathFromUrl(publicUrl: string): string | null {
  const marker = `/object/public/${MENU_IMAGES_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

/**
 * Deletes a list of image URLs from Supabase Storage.
 * Silently skips URLs that don't belong to this bucket.
 */
export async function deleteImages(imageUrls: string[]): Promise<void> {
  const paths = imageUrls.map(pathFromUrl).filter(Boolean) as string[];
  if (paths.length === 0) return;

  const client = getStorageClient();
  const { error } = await client.storage
    .from(MENU_IMAGES_BUCKET)
    .remove(paths);

  if (error) {
    console.error("Storage delete error:", error.message);
  }
}
