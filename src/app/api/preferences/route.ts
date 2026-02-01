import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/**
 * GET /api/preferences - Get user preferences
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await db.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    // Return defaults if no preferences exist
    return NextResponse.json(
      preferences || {
        locale: "es-ES",
        currency: "EUR",
      }
    );
  } catch (error) {
    console.error("Get preferences error:", error);
    return NextResponse.json({ error: "Failed to get preferences" }, { status: 500 });
  }
}

/**
 * PATCH /api/preferences - Update user preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { locale, currency } = body;

    // Validate locale
    const validLocales = ["es-ES", "en-US", "en-GB", "de-DE", "fr-FR", "it-IT", "pt-PT", "pt-BR"];
    if (locale && !validLocales.includes(locale)) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }

    // Validate currency
    const validCurrencies = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "BRL"];
    if (currency && !validCurrencies.includes(currency)) {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }

    const updateData: { locale?: string; currency?: string } = {};
    if (locale) updateData.locale = locale;
    if (currency) updateData.currency = currency;

    const preferences = await db.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        locale: locale || "es-ES",
        currency: currency || "EUR",
      },
      update: updateData,
    });

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
