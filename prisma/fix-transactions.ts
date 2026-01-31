/**
 * Fix script for transaction type issues:
 * 1. Card payment refunds incorrectly marked as EXPENSE should be INCOME
 * 2. Any other transaction issues
 *
 * Run with: pnpm tsx prisma/fix-transactions.ts
 */

import { PrismaClient } from "@prisma/client";
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

async function fixTransactions() {
  console.log("Starting transaction fix script...\n");

  // Find all transactions to analyze
  const allTransactions = await prisma.transaction.findMany({
    include: { category: true },
    orderBy: { date: "desc" },
  });

  console.log(`Found ${allTransactions.length} total transactions\n`);

  // Track fixes
  let refundsFixed = 0;
  let transfersFixed = 0;

  for (const tx of allTransactions) {
    const description = tx.description?.toLowerCase() || "";
    const wiseRef = tx.wiseRefNumber || "";

    // Check if this looks like a refund that's marked as EXPENSE
    // Refunds typically have positive amounts but are marked as EXPENSE incorrectly
    // The wiseRefNumber contains the activity ID which we can use to identify the type
    // However, we don't have the original Wise activity type stored

    // Heuristic: If description contains "refund" and type is EXPENSE, it's likely wrong
    const isLikelyRefund =
      (description.includes("refund") ||
        description.includes("reembolso") ||
        description.includes("devolucion") ||
        description.includes("devolución")) &&
      tx.type === "EXPENSE";

    if (isLikelyRefund) {
      console.log(
        `[REFUND] "${tx.description}" on ${tx.date.toISOString().split("T")[0]}`
      );
      console.log(`  Current type: ${tx.type}, Amount: ${tx.amountEur} EUR`);
      console.log(`  -> Fixing to INCOME\n`);

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { type: "INCOME" },
      });
      refundsFixed++;
    }

    // Check for transactions with TRANSFER category that are marked as EXPENSE
    if (tx.type === "EXPENSE" && tx.category?.type === "TRANSFER") {
      console.log(
        `[TRANSFER CAT] "${tx.description}" on ${tx.date.toISOString().split("T")[0]}`
      );
      console.log(`  Current type: ${tx.type}, Category: ${tx.category.name}`);
      console.log(`  -> Fixing to TRANSFER\n`);

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { type: "TRANSFER" },
      });
      transfersFixed++;
    }

    // Also fix INCOME transactions with TRANSFER category (receiving side of internal transfers)
    if (tx.type === "INCOME" && tx.category?.type === "TRANSFER") {
      console.log(
        `[TRANSFER CAT] "${tx.description}" on ${tx.date.toISOString().split("T")[0]}`
      );
      console.log(`  Current type: ${tx.type}, Category: ${tx.category.name}`);
      console.log(`  -> Fixing to TRANSFER\n`);

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { type: "TRANSFER" },
      });
      transfersFixed++;
    }
  }

  console.log("=".repeat(50));
  console.log(`Fix summary:`);
  console.log(`  Refunds fixed: ${refundsFixed}`);
  console.log(`  Transfers fixed: ${transfersFixed}`);
  console.log(`  Total fixed: ${refundsFixed + transfersFixed}`);

  // Also show any transactions that might need manual review
  console.log("\n" + "=".repeat(50));
  console.log("Transactions that might need manual review:\n");

  const suspiciousTransactions = allTransactions.filter((tx) => {
    const desc = tx.description?.toLowerCase() || "";
    // Transactions with "Internal Transfer" in category but not TRANSFER type
    if (tx.category?.name === "Internal Transfer" && tx.type !== "TRANSFER") {
      return true;
    }
    // Any transaction with certain keywords that are EXPENSE
    if (
      tx.type === "EXPENSE" &&
      (desc.includes("refund") ||
        desc.includes("reembolso") ||
        desc.includes("cashback"))
    ) {
      return true;
    }
    return false;
  });

  if (suspiciousTransactions.length === 0) {
    console.log("No suspicious transactions found!");
  } else {
    for (const tx of suspiciousTransactions) {
      console.log(
        `- "${tx.description}" | Type: ${tx.type} | Category: ${tx.category?.name || "None"} | ${tx.date.toISOString().split("T")[0]}`
      );
    }
  }
}

fixTransactions()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
