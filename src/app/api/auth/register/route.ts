import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/lib/server/db";
import { generateTotpSecret, encryptTotpSecret } from "@/lib/utils/totp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate 2FA secret (will be activated after setup)
    const totpSecret = generateTotpSecret();
    const encryptedSecret = encryptTotpSecret(totpSecret);

    // Create user with 2FA secret but not enabled yet
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: false, // Will be enabled after verification
      },
    });

    return NextResponse.json({
      userId: user.id,
      message: "Account created. Please set up 2FA to continue.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
