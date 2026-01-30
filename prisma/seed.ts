import { PrismaClient, CategoryType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const defaultCategories = [
  // Fixed Expenses (Recurring)
  { name: "Rent", icon: "Home", color: "#8B5CF6", type: CategoryType.FIXED_EXPENSE },
  { name: "Electricity", icon: "Zap", color: "#F59E0B", type: CategoryType.FIXED_EXPENSE },
  { name: "Natural Gas", icon: "Flame", color: "#EF4444", type: CategoryType.FIXED_EXPENSE },
  { name: "Water", icon: "Droplets", color: "#06B6D4", type: CategoryType.FIXED_EXPENSE },
  { name: "Internet", icon: "Wifi", color: "#3B82F6", type: CategoryType.FIXED_EXPENSE },
  { name: "Gym", icon: "Dumbbell", color: "#10B981", type: CategoryType.FIXED_EXPENSE },
  { name: "Phone", icon: "Smartphone", color: "#6366F1", type: CategoryType.FIXED_EXPENSE },
  { name: "Insurance", icon: "Shield", color: "#EC4899", type: CategoryType.FIXED_EXPENSE },

  // Variable Expenses (Budgetable)
  { name: "Food", icon: "ShoppingCart", color: "#22C55E", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Clothing", icon: "Shirt", color: "#A855F7", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Tech", icon: "Laptop", color: "#64748B", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Restaurants", icon: "UtensilsCrossed", color: "#F97316", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Bars", icon: "Wine", color: "#DC2626", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Travel", icon: "Plane", color: "#0EA5E9", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Entertainment", icon: "Gamepad2", color: "#8B5CF6", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Healthcare", icon: "Heart", color: "#EF4444", type: CategoryType.VARIABLE_EXPENSE },
  { name: "Other Expenses", icon: "HelpCircle", color: "#94A3B8", type: CategoryType.VARIABLE_EXPENSE },

  // Income
  { name: "Salary", icon: "Briefcase", color: "#16A34A", type: CategoryType.INCOME },
  { name: "Freelance", icon: "PenTool", color: "#059669", type: CategoryType.INCOME },
  { name: "Other Income", icon: "CircleDollarSign", color: "#14B8A6", type: CategoryType.INCOME },

  // Investments
  { name: "Index Funds", icon: "TrendingUp", color: "#2563EB", type: CategoryType.INVESTMENT },
  { name: "ETFs", icon: "BarChart3", color: "#7C3AED", type: CategoryType.INVESTMENT },
  { name: "Stocks", icon: "LineChart", color: "#DB2777", type: CategoryType.INVESTMENT },
  { name: "Crypto", icon: "Bitcoin", color: "#F59E0B", type: CategoryType.INVESTMENT },

  // Transfers (not counted in budgets)
  { name: "Internal Transfer", icon: "ArrowLeftRight", color: "#6B7280", type: CategoryType.TRANSFER },
];

// Keywords for auto-categorization
const categoryKeywords: Record<string, string[]> = {
  "Food": ["supermarket", "grocery", "mercadona", "lidl", "aldi", "carrefour", "eroski", "dia"],
  "Restaurants": ["restaurant", "cafe", "coffee", "mcdonald", "burger", "pizza", "sushi", "bar restaurante"],
  "Bars": ["bar", "pub", "nightclub", "club", "cerveceria"],
  "Transportation": ["uber", "taxi", "cabify", "bolt", "metro", "bus", "train", "renfe", "gas station", "fuel"],
  "Tech": ["amazon", "apple", "mediamarkt", "pccomponentes", "aliexpress"],
  "Entertainment": ["netflix", "spotify", "hbo", "disney", "cinema", "steam", "playstation", "xbox"],
  "Gym": ["gym", "fitness", "gimnasio"],
  "Phone": ["vodafone", "movistar", "orange", "yoigo", "o2"],
  "Internet": ["internet", "fiber", "fibra"],
  "Insurance": ["insurance", "seguro", "mapfre", "axa", "allianz"],
  "Healthcare": ["pharmacy", "farmacia", "doctor", "hospital", "clinic", "dentist"],
  "Clothing": ["zara", "hm", "mango", "pull&bear", "bershka", "stradivarius", "uniqlo"],
};

async function main() {
  console.log("Seeding database...");

  // Create categories
  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
        isSystem: true,
      },
    });
    console.log(`Created category: ${category.name}`);
  }

  // Create category keywords for auto-detection
  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    const category = await prisma.category.findUnique({
      where: { name: categoryName },
    });

    if (category) {
      for (const keyword of keywords) {
        await prisma.categoryKeyword.upsert({
          where: {
            categoryId_keyword: {
              categoryId: category.id,
              keyword: keyword.toLowerCase(),
            },
          },
          update: {},
          create: {
            categoryId: category.id,
            keyword: keyword.toLowerCase(),
          },
        });
      }
      console.log(`Added ${keywords.length} keywords to ${categoryName}`);
    }
  }

  // Create default app settings
  await prisma.appSettings.upsert({
    where: { id: "settings" },
    update: {},
    create: {
      id: "settings",
      primaryCurrency: "EUR",
      emergencyFundMonths: 6,
      syncIntervalHours: 6,
    },
  });
  console.log("Created default app settings");

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
