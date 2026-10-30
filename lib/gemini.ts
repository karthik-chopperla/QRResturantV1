import { GoogleGenAI } from "@google/genai";

const MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash"
];

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_INSTRUCTION = `You are an expert restaurant menu parser.

Extract every menu item visible in the image.

For each item determine:
- name (preserve exactly as written)
- description (write a concise 1-2 sentence description if not visible; base it on the dish name and ingredients)
- price (numeric, no currency symbols)
- food type (VEG, NON_VEG, or VEGAN)
- spicy level (0 to 3)
- ingredients (only visible/implied ingredients)
- allergens (only if explicitly indicated)
- category (assign the most appropriate menu category)

Category rules:
- Use common restaurant categories: "Appetizers", "Starters", "Soups", "Salads", "Main Course", "Breads", "Rice & Biryani", "Noodles", "Snacks", "Street Food", "Beverages", "Desserts", "Ice Cream", "Thali", "Combos", "Tandoor", "Chinese", "South Indian", "North Indian", "Continental", "Italian", "Mexican", "Thai", "Seafood", "Grill & BBQ", "Kids Menu", "Sides", "Extras", "Breakfast"
- Match the category to the cuisine and type of dish
- Keep category names short and consistent (1-3 words)
- If a dish could fit multiple categories, pick the most specific one

Rules:
- Ignore decorative text, restaurant address, phone numbers, GST, QR codes, page headers/footers
- Ignore combo titles unless they represent actual menu items
- Preserve item names exactly as written
- Prices must be numeric (no currency symbols)
- If price is unavailable use 0
- If food type cannot be determined use VEG
- If spicy level is unknown use 0
- Generate a description for every item — never leave it empty
- Ingredients should only include visible/implied ingredients
- Never hallucinate ingredients or allergens

Return only valid JSON in the exact schema provided. No markdown. No explanations.`;

const JSON_SCHEMA_INSTRUCTION = `Respond with a JSON object matching this exact schema:
{
  "items": [
    {
      "name": "string",
      "description": "string (1-2 sentence description of the dish)",
      "price": 0,
      "foodType": "VEG" | "NON_VEG" | "VEGAN",
      "spicyLevel": 0,
      "ingredients": ["string"],
      "allergens": ["string"],
      "category": "string (e.g. Appetizers, Main Course, Beverages)"
    }
  ]
}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(
  base64Data: string,
  mimeType: string,
  model: string
): Promise<unknown> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this restaurant menu image and extract all menu items. ${JSON_SCHEMA_INSTRUCTION}`,
          },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from AI model.");
  }

  return JSON.parse(text);
}

export async function analyzeMenuImage(
  base64Data: string,
  mimeType: string
): Promise<unknown> {
  let lastError: unknown;

  for (const model of MODEL_CHAIN) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await callGemini(base64Data, mimeType, model);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const errLower = msg.toLowerCase();
        
        const isTransient = 
          errLower.includes("503") || 
          errLower.includes("unavailable") || 
          errLower.includes("429") || 
          errLower.includes("resource_exhausted") ||
          errLower.includes("high demand") || 
          errLower.includes("temporary");

        if (isTransient && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.warn(`[gemini] Model ${model} transient error: ${msg}. Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
          await sleep(delay);
        } else {
          // Non-transient error or max retries exceeded, break retry loop to try next model in chain
          console.warn(`[gemini] Model ${model} failed: ${msg}. Trying next model...`);
          break;
        }
      }
    }
  }

  throw lastError;
}
