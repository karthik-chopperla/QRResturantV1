import { PrismaClient, FoodType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import fs from "fs";
import path from "path";

// Load env variables manually if not loaded (e.g. when run via tsx directly)
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const firstEqual = trimmed.indexOf("=");
          if (firstEqual !== -1) {
            const key = trimmed.slice(0, firstEqual).trim();
            let val = trimmed.slice(firstEqual + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to load .env manually:", err);
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  console.log("Cleaning up existing categories and menu items...");
  await prisma.menuItem.deleteMany({});
  await prisma.category.deleteMany({});

  // Ensure settings exists
  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    await prisma.settings.create({
      data: {
        id: "singleton",
        restaurantName: "Spice Garden",
        logo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80",
        banner: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
        phone: "+919876543210",
        email: "info@spicegarden.com",
        address: "123 Gourmet Boulevard, Food District, New Delhi - 110001",
        primaryColor: "#DC2626",
        currency: "INR",
        timezone: "Asia/Kolkata",
        gstNumber: "07AAAAA1111A1Z1",
        gstPercentage: "5.0",
        serviceChargePercentage: "2.5",
        openingHours: {
          monday: { open: "11:00", close: "23:00", closed: false },
          tuesday: { open: "11:00", close: "23:00", closed: false },
          wednesday: { open: "11:00", close: "23:00", closed: false },
          thursday: { open: "11:00", close: "23:00", closed: false },
          friday: { open: "11:00", close: "23:30", closed: false },
          saturday: { open: "11:00", close: "23:30", closed: false },
          sunday: { open: "11:00", close: "23:00", closed: false },
        },
      },
    });
    console.log("Seeded default settings.");
  } else {
    // Update name to match Spice Garden mockup
    await prisma.settings.update({
      where: { id: "singleton" },
      data: { restaurantName: "Spice Garden" },
    });
  }

  // Ensure tables exist
  const tableCount = await prisma.table.count();
  if (tableCount === 0) {
    await prisma.table.create({ data: { number: "T1", status: "AVAILABLE" } });
    await prisma.table.create({ data: { number: "T2", status: "AVAILABLE" } });
    await prisma.table.create({ data: { number: "T3", status: "AVAILABLE" } });
    console.log("Seeded default tables T1, T2, T3.");
  }

  console.log("Seeding categories and menu items...");

  // Define Category structure with flat names using path separators
  const categoriesList = [
    // Vegetarian sub tree
    { name: "Vegetarian", sortOrder: 1 },
    { name: "Vegetarian > Main Course", sortOrder: 2 },
    { name: "Vegetarian > Main Course > Paneer", sortOrder: 3 },
    { name: "Vegetarian > Main Course > Mushroom", sortOrder: 4 },
    { name: "Vegetarian > Main Course > Dal", sortOrder: 5 },
    { name: "Vegetarian > Main Course > Mix Veg", sortOrder: 6 },
    { name: "Vegetarian > Main Course > Kofta", sortOrder: 7 },
    { name: "Vegetarian > Starters", sortOrder: 8 },
    { name: "Vegetarian > Rice & Biryani", sortOrder: 9 },
    { name: "Vegetarian > Breads", sortOrder: 10 },
    { name: "Vegetarian > Chinese", sortOrder: 11 },
    { name: "Vegetarian > South Indian", sortOrder: 12 },

    // Non-Vegetarian sub tree
    { name: "Non-Vegetarian", sortOrder: 13 },
    { name: "Non-Vegetarian > Chicken", sortOrder: 14 },
    { name: "Non-Vegetarian > Mutton", sortOrder: 15 },
    { name: "Non-Vegetarian > Fish", sortOrder: 16 },
    { name: "Non-Vegetarian > Egg", sortOrder: 17 },
    { name: "Non-Vegetarian > Seafood", sortOrder: 18 },

    // Others
    { name: "Beverages", sortOrder: 19 },
    { name: "Desserts", sortOrder: 20 },
    { name: "Soups & Salads", sortOrder: 21 },
  ];

  const dbCategories: Record<string, any> = {};

  for (const cat of categoriesList) {
    const dbCat = await prisma.category.create({
      data: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        description: `Delightful items in ${cat.name.split(" > ").pop()}`,
      },
    });
    dbCategories[cat.name] = dbCat;
  }

  // 1. Seed detailed Paneer items under "Vegetarian > Main Course > Paneer"
  const paneerCategoryId = dbCategories["Vegetarian > Main Course > Paneer"].id;
  const paneerItems = [
    {
      name: "Paneer Butter Masala",
      description: "Rich, creamy and delicious gravy with soft paneer cubes",
      price: "280",
      discountPrice: "250",
      foodType: FoodType.VEG,
      spicyLevel: 1,
      preparationTime: 15,
      isBestSeller: true,
      isChefSpecial: false,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Tomato", "Cream", "Butter", "Spices"],
      allergens: ["Dairy"],
      nutrition: { calories: 320 },
    },
    {
      name: "Paneer Lababdar",
      description: "Authentic Punjabi style rich and spicy curry",
      price: "290",
      foodType: FoodType.VEG,
      spicyLevel: 2,
      preparationTime: 15,
      isBestSeller: false,
      isChefSpecial: true,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Onion", "Tomato", "Cream", "Cashew"],
      allergens: ["Dairy", "Nuts"],
      nutrition: { calories: 340 },
    },
    {
      name: "Kadai Paneer",
      description: "Spicy paneer cooked with bell peppers and onions",
      price: "270",
      foodType: FoodType.VEG,
      spicyLevel: 2,
      preparationTime: 15,
      isBestSeller: false,
      isChefSpecial: false,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Capsicum", "Onion", "Kadai Masala"],
      allergens: ["Dairy"],
      nutrition: { calories: 310 },
    },
    {
      name: "Paneer Do Pyaza",
      description: "Paneer cooked with double onions",
      price: "260",
      foodType: FoodType.VEG,
      spicyLevel: 1,
      preparationTime: 15,
      isBestSeller: false,
      isChefSpecial: false,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Onions", "Spices", "Tomato"],
      allergens: ["Dairy"],
      nutrition: { calories: 300 },
    },
    {
      name: "Palak Paneer",
      description: "Cottage cheese cubes in smooth spinach gravy",
      price: "280",
      foodType: FoodType.VEG,
      spicyLevel: 1,
      preparationTime: 15,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1613292443284-8d10ef9383fe?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Spinach", "Garlic", "Cream"],
      allergens: ["Dairy"],
      nutrition: { calories: 280 },
    },
    {
      name: "Shahi Paneer",
      description: "Royal preparation with rich cashew gravy",
      price: "300",
      discountPrice: "270",
      foodType: FoodType.VEG,
      spicyLevel: 1,
      preparationTime: 15,
      isBestSeller: true,
      isChefSpecial: false,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Cashew nuts", "Saffron", "Cream"],
      allergens: ["Dairy", "Nuts"],
      nutrition: { calories: 350 },
    },
    // Add 4 more paneer items to make it 10 items (1 unavailable to match screenshot tabs All: 10, Available: 9, Unavailable: 1, Bestseller: 3)
    {
      name: "Paneer Tikka Masala",
      description: "Grilled paneer tikka tossed in spicy onion tomato gravy",
      price: "290",
      foodType: FoodType.VEG,
      spicyLevel: 2,
      preparationTime: 20,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Yogurt", "Capsicum", "Spices"],
      allergens: ["Dairy"],
      nutrition: { calories: 330 },
    },
    {
      name: "Mutter Paneer",
      description: "Classic combination of green peas and paneer in curry",
      price: "250",
      foodType: FoodType.VEG,
      spicyLevel: 1,
      preparationTime: 15,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Green Peas", "Tomato", "Spices"],
      allergens: ["Dairy"],
      nutrition: { calories: 290 },
    },
    {
      name: "Paneer Bhurji",
      description: "Scrambled paneer cooked with onions, tomatoes and spices",
      price: "240",
      foodType: FoodType.VEG,
      spicyLevel: 2,
      preparationTime: 12,
      isAvailable: true,
      images: ["https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Onion", "Tomato", "Green Chili"],
      allergens: ["Dairy"],
      nutrition: { calories: 270 },
    },
    {
      name: "Paneer Pasanda",
      description: "Rich paneer sandwiches stuffed with nuts and shallow fried in cream gravy",
      price: "320",
      foodType: FoodType.VEG,
      spicyLevel: 1,
      preparationTime: 20,
      isAvailable: false, // 1 unavailable item!
      images: ["https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&auto=format&fit=crop&q=80"],
      ingredients: ["Paneer", "Cashews", "Raisins", "Khoya", "Cream"],
      allergens: ["Dairy", "Nuts"],
      nutrition: { calories: 410 },
    },
  ];

  for (const item of paneerItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: paneerCategoryId,
      },
    });
  }

  // 2. Loop to seed items in other categories to match counts
  // Count mapping:
  const counts: Record<string, { count: number; vegType: FoodType; baseName: string; price: string }> = {
    "Vegetarian > Main Course > Mushroom": { count: 8, vegType: FoodType.VEG, baseName: "Mushroom", price: "240" },
    "Vegetarian > Main Course > Dal": { count: 6, vegType: FoodType.VEG, baseName: "Dal", price: "180" },
    "Vegetarian > Main Course > Mix Veg": { count: 4, vegType: FoodType.VEG, baseName: "Veg", price: "210" },
    "Vegetarian > Main Course > Kofta": { count: 4, vegType: FoodType.VEG, baseName: "Kofta", price: "260" },
    "Vegetarian > Starters": { count: 14, vegType: FoodType.VEG, baseName: "Veg Starter", price: "190" },
    "Vegetarian > Rice & Biryani": { count: 8, vegType: FoodType.VEG, baseName: "Veg Rice", price: "220" },
    "Vegetarian > Breads": { count: 10, vegType: FoodType.VEG, baseName: "Roti / Naan", price: "40" },
    "Vegetarian > Chinese": { count: 6, vegType: FoodType.VEG, baseName: "Veg Chinese", price: "180" },
    "Vegetarian > South Indian": { count: 4, vegType: FoodType.VEG, baseName: "South Indian Special", price: "130" },

    "Non-Vegetarian > Chicken": { count: 20, vegType: FoodType.NON_VEG, baseName: "Chicken", price: "320" },
    "Non-Vegetarian > Mutton": { count: 8, vegType: FoodType.NON_VEG, baseName: "Mutton", price: "380" },
    "Non-Vegetarian > Fish": { count: 6, vegType: FoodType.NON_VEG, baseName: "Fish", price: "340" },
    "Non-Vegetarian > Egg": { count: 4, vegType: FoodType.NON_VEG, baseName: "Egg Dish", price: "160" },
    "Non-Vegetarian > Seafood": { count: 4, vegType: FoodType.NON_VEG, baseName: "Prawns", price: "390" },

    "Beverages": { count: 10, vegType: FoodType.VEG, baseName: "Drink", price: "80" },
    "Desserts": { count: 8, vegType: FoodType.VEG, baseName: "Sweet", price: "120" },
    "Soups & Salads": { count: 6, vegType: FoodType.VEG, baseName: "Soup / Salad", price: "140" },
  };

  // Keep track of total items seeded to check
  let generatedCount = paneerItems.length;

  for (const [catName, config] of Object.entries(counts)) {
    const catId = dbCategories[catName].id;
    for (let i = 1; i <= config.count; i++) {
      // Make 1 item in each category unavailable for realism, except if count is very small
      const isAvailable = !(i === config.count && config.count > 5); 
      // Make some bestseller/chef special randomly
      const isBestSeller = i === 1 || (i === 3 && config.count > 10);
      const isChefSpecial = i === 2;

      await prisma.menuItem.create({
        data: {
          name: `${config.baseName} Special ${i}`,
          description: `Delicious and authentic preparation of ${config.baseName} with select spices.`,
          price: String(Number(config.price) + (i * 10)),
          foodType: config.vegType,
          spicyLevel: (i % 3),
          preparationTime: 12 + (i % 10),
          isAvailable,
          isBestSeller,
          isChefSpecial,
          images: [],
          ingredients: [config.baseName, "Spices", "Herbs"],
          allergens: [],
          categoryId: catId,
        },
      });
      generatedCount++;
    }
  }

  // Also verify stats
  const totalItems = await prisma.menuItem.count();
  const vegItems = await prisma.menuItem.count({ where: { foodType: { in: [FoodType.VEG, FoodType.VEGAN] } } });
  const nonVegItems = await prisma.menuItem.count({ where: { foodType: FoodType.NON_VEG } });
  const unavailableItems = await prisma.menuItem.count({ where: { isAvailable: false } });

  console.log(`\nSeeded database successfully:`);
  console.log(`  Total Items:       ${totalItems}`);
  console.log(`  Vegetarian:        ${vegItems}`);
  console.log(`  Non-Vegetarian:    ${nonVegItems}`);
  console.log(`  Unavailable:       ${unavailableItems}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
