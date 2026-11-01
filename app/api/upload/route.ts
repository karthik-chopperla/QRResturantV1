import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStorageClient, MENU_IMAGES_BUCKET } from "@/lib/supabase/storage";
import { getCurrentUser } from "@/actions/auth";
import { Role } from "@prisma/client";
import { validateMagicBytes } from "@/lib/file-validation";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  // 1. Authenticate — only logged-in staff may upload
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Role check — only the restaurant owner can upload
  const dbUser = await getCurrentUser();
  if (!dbUser || dbUser.role !== Role.RESTAURANT_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse the multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  // 3. Validate file type and size
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size must be under 5 MB." },
      { status: 400 }
    );
  }

  // 4. Validate magic bytes server-side (don't trust client Content-Type)
  const buffer = await file.arrayBuffer();
  const magic = validateMagicBytes(buffer, ALLOWED_MIME_TYPES);
  if (!magic.valid) {
    return NextResponse.json({ error: magic.error }, { status: 400 });
  }

  // 5. Build a unique, sanitised storage path
  //    Format: menu-items/<userId>/<timestamp>-<sanitized-filename>
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storagePath = `menu-items/${user.id}/${safeName}`;

  // 6. Upload to Supabase Storage using the service-role client
  //    (service role bypasses RLS so the bucket can be private while still
  //     allowing staff to upload via this authenticated endpoint)
  const storageClient = getStorageClient();

  const { error: uploadError } = await storageClient.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase Storage upload error:", uploadError.message);
    return NextResponse.json(
      { error: "Upload failed: " + uploadError.message },
      { status: 500 }
    );
  }

  // 6. Return the public URL
  const { data: urlData } = storageClient.storage
    .from(MENU_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  return NextResponse.json({ url: urlData.publicUrl }, { status: 200 });
}
