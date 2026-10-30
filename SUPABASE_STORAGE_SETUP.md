# Supabase Storage Setup for Menu Images

This project now uses **Supabase Storage** (S3-compatible) to store uploaded menu item images. Follow these steps to complete the setup:

---

## 1. Create the Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/`<your-project-ref>`
2. Navigate to **Storage** in the sidebar
3. Click **Create a new bucket**
4. Set:
   - **Name**: `menu-images`
   - **Public**: ✅ **ON** (images will be publicly accessible)
   - **File size limit**: 5 MB (or higher if needed)
   - **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
5. Click **Create bucket**

---

## 2. Verify Environment Variables

Ensure the following are set in your `.env` file:

```bash
# These are required — the app will throw an error if they're missing
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."  # Service role key (secret!)
```

The upload API route uses the **service role key** server-side to bypass RLS (Row Level Security), allowing authenticated staff to upload images while keeping the bucket itself publicly readable but not publicly writable.

---

## 3. Test the Upload Flow

1. Run the dev server: `npm run dev`
2. Log in as an admin at `/login`
3. Go to **Dashboard → Menu → Add Item**
4. Upload an image using the drag-drop zone or file picker
5. You should see:
   - A progress bar while uploading
   - The image preview once uploaded
   - The image URL stored in the database (inspect the form)
6. Save the menu item
7. Verify the image displays correctly on:
   - The admin menu management page
   - The customer menu at `/menu/table-1`

---

## 4. Optional: Enable RLS on the Bucket (Advanced)

By default, the `menu-images` bucket is **public** (anyone can read). If you want to restrict uploads to authenticated users while keeping reads public:

1. In **Supabase Dashboard → Storage → menu-images → Policies**
2. Enable RLS (Row Level Security)
3. Add a policy:
   - **Policy name**: "Public read access"
   - **Operation**: SELECT
   - **Policy definition**: `true` (allow all)
4. The upload endpoint already uses the service role key, so staff uploads will bypass RLS automatically.

---

## Troubleshooting

### "Upload failed: Invalid credentials"
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly in `.env`
- Restart your dev server after changing env vars

### "Storage bucket not found"
- Ensure the bucket is named exactly `menu-images` (lowercase, hyphen)
- Check that you created it in the correct Supabase project

### Images not displaying
- Verify the bucket is set to **Public**
- Check that `*.supabase.co` is in `next.config.ts` under `images.remotePatterns` (already there)
- Open the image URL directly in your browser to confirm it's accessible

### Large files timing out
- Increase the 5 MB limit in `app/api/upload/route.ts` (`MAX_FILE_SIZE`)
- Also increase it in the Supabase bucket settings if needed

---

## How It Works

1. **Client** selects image files using the `<ImageUpload>` component
2. **Component** previews the files and sends them to `/api/upload` via `XMLHttpRequest` (for progress tracking)
3. **API route** (`/api/upload/route.ts`) authenticates the user, validates file type/size, and uploads to Supabase Storage using the service role client
4. **Storage** stores the file at `menu-items/<userId>/<timestamp-random>.<ext>`
5. **API** returns the public URL: `https://xxxx.supabase.co/storage/v1/object/public/menu-images/...`
6. **Component** adds the URL to the form state
7. **Form** saves the URL array to `menuItem.images` in the database
8. When a menu item is deleted, `deleteMenuItem` also removes the images from storage

---

## Migration from URL Input

If you have existing menu items with external image URLs (e.g., from Unsplash), they will continue to work. The new upload feature coexists with external URLs — the system only deletes images from Supabase Storage if the URL matches the bucket pattern.

To migrate existing items:
1. Download the external image
2. Edit the menu item
3. Remove the old external URL (click the X button on the image thumbnail)
4. Upload the downloaded file via the new upload component
5. Save the item

---

You're all set! 🎉
