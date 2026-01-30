import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateQrCodeDataUrl, decryptTotpSecret } from "@/lib/utils/totp";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled for this account" },
        { status: 400 }
      );
    }

    // Check if user has a secret
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA secret not found. Please register again." },
        { status: 400 }
      );
    }

    // Decrypt the secret
    const decryptedSecret = decryptTotpSecret(user.twoFactorSecret);

    // Generate QR code
    const qrCodeUrl = await generateQrCodeDataUrl(user.email, decryptedSecret);

    return NextResponse.json({
      qrCodeUrl,
      secret: decryptedSecret, // For manual entry
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
