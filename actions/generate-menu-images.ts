"use server";

import { GoogleGenAI } from "@google/genai";
import { getStorageClient, getPublicUrl } from "@/lib/supabase/storage";
import { requireAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";

const IMAGE_SEARCH_MODEL = "gemini-3.5-flash-lite";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function findWikimediaImage(dishName: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&piprop=original&gsrsearch=${encodeURIComponent(dishName + " food")}&gsrlimit=1&origin=*`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    
    const pages = data?.query?.pages;
    if (!pages) return null;
    
    for (const key of Object.keys(pages)) {
      const imgUrl = pages[key]?.original?.source;
      if (imgUrl) return imgUrl;
    }
    return null;
  } catch (error) {
    console.error("[image-search] Wikimedia fetch error:", error);
    return null;
  }
}

async function simplifyDishName(dishName: string): Promise<string> {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_SEARCH_MODEL,
      contents: `Identify the main generic edible item or dish in this name: "${dishName}". 
Return ONLY the short, common, search-friendly name of the dish (e.g., if input is "Chef Special Spicy Tandoori Chicken Tikka", return "Tandoori Chicken"). 
Do not include adjectives like "special", "chef", "spicy", "hot", or restaurant names. 
Return ONLY the clean dish name, nothing else.`
    });
    
    return response.text?.trim() || dishName;
  } catch (err) {
    console.error("[image-search] Gemini name simplification error:", err);
    return dishName;
  }
}

async function findImageForDish(dishName: string): Promise<string | null> {
  try {
    // 1. Try full name search
    let url = await findWikimediaImage(dishName);
    if (url) {
      return url;
    }
    
    // 2. Simplify name using Gemini
    const simplified = await simplifyDishName(dishName);
    
    // 3. Try simplified search
    url = await findWikimediaImage(simplified);
    if (url) {
      return url;
    }
    
    // 4. Return a generic high-quality food image as a fallback
    return "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80";
  } catch (error) {
    console.error(`[image-search] Failed for "${dishName}":`, error);
    return "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80";
  }
}

async function downloadAndUploadImage(
  imageUrl: string,
  dishName: string,
  userId: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MenuApp/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[image-download] Failed to download: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      console.error(`[image-download] Not an image: ${contentType}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    
    // Validate size (max 5MB)
    if (buffer.byteLength > 5 * 1024 * 1024) {
      console.error(`[image-download] Image too large: ${buffer.byteLength} bytes`);
      return null;
    }

    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const safeName = dishName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    const storagePath = `menu-items/${userId}/${safeName}-${Date.now()}.${ext}`;

    const storageClient = getStorageClient();
    const { error: uploadError } = await storageClient.storage
      .from("menu-images")
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`[image-upload] Failed:`, uploadError.message);
      return null;
    }

    return getPublicUrl(storagePath);
  } catch (error) {
    console.error(`[image-download] Error:`, error);
    return null;
  }
}

export interface GenerateImagesResult {
  success: true;
  results: { dishName: string; imageUrl: string | null }[];
}

export interface GenerateImagesError {
  success: false;
  error: string;
}

export type GenerateImagesResponse = GenerateImagesResult | GenerateImagesError;

export async function generateMenuImages(
  dishNames: string[]
): Promise<GenerateImagesResponse> {
  const user = await requireAdmin();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!dishNames || dishNames.length === 0) {
    return { success: false, error: "No dish names provided." };
  }

  // Limit to 20 items per batch to avoid rate limits
  const itemsToProcess = dishNames.slice(0, 20);
  const results: { dishName: string; imageUrl: string | null }[] = [];

  // Process in batches of 5 with delay between batches
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 1500;

  for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
    const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (dishName) => {
        const imageUrl = await findImageForDish(dishName);
        if (!imageUrl) {
          return { dishName, imageUrl: null };
        }

        const storedUrl = await downloadAndUploadImage(imageUrl, dishName, user.id);
        return { dishName, imageUrl: storedUrl };
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({ dishName: "unknown", imageUrl: null });
      }
    }

    // Delay between batches (except for the last batch)
    if (i + BATCH_SIZE < itemsToProcess.length) {
      await sleep(BATCH_DELAY);
    }
  }

  revalidatePath("/dashboard/menu");
  
  return { success: true, results };
}
