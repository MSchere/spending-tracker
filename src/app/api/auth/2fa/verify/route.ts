import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { verifyTotp, decryptTotpSecret } from "@/lib/utils/totp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: "User ID and code are required" },
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

    // Verify the TOTP code
    const decryptedSecret = decryptTotpSecret(user.twoFactorSecret);
    const isValid = verifyTotp(code, decryptedSecret);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Enable 2FA
    await db.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return NextResponse.json({
      message: "2FA enabled successfully",
      email: user.email,
    });
  } catch (error) {
    console.error("2FA verification error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
