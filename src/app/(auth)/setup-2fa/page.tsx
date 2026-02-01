"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShieldCheck, Copy, Check } from "lucide-react";

function Setup2FAForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const formRef = useRef<HTMLFormElement>(null);

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) {
      toast.error("Invalid setup link");
      router.push("/register");
      return;
    }

    // Fetch 2FA setup data
    fetch(`/api/auth/2fa/setup?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
          router.push("/register");
          return;
        }
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
      })
      .catch(() => {
        toast.error("Failed to load 2FA setup");
        router.push("/register");
      })
      .finally(() => setIsLoading(false));
  }, [userId, router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    if (totpCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: totpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      toast.success("2FA enabled successfully! Please sign in.");

      // Redirect to login page with email pre-filled
      router.push(`/login?email=${encodeURIComponent(data.email)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsVerifying(false);
    }
  }

  function copySecret() {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Secret copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-2xl">Set up 2FA</CardTitle>
        </div>
        <CardDescription>
          Scan the QR code with your authenticator app to enable two-factor authentication
        </CardDescription>
      </CardHeader>
      <form ref={formRef} onSubmit={handleVerify} className="flex flex-col gap-8">
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            {isLoading ? (
              <Skeleton className="w-48 h-48" />
            ) : qrCodeUrl ? (
              <div className="p-4 bg-white rounded-lg">
                <Image
                  src={qrCodeUrl}
                  alt="2FA QR Code"
                  width={192}
                  height={192}
                  className="w-48 h-48"
                />
              </div>
            ) : null}
          </div>

          {/* Manual entry option */}
          {secret && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Or enter this code manually:
              </p>
              <div className="flex items-center justify-center gap-2">
                <code className="bg-muted px-3 py-1 rounded text-sm font-mono">{secret}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={copySecret}
                  disabled={copied}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="totp">Verification Code</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={totpCode}
                onChange={(value) => setTotpCode(value)}
                onComplete={() => {
                  formRef.current?.requestSubmit();
                }}
                disabled={isLoading || isVerifying}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || isVerifying || totpCode.length !== 6}
          >
            {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enable 2FA
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function Setup2FASkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-2xl">Set up 2FA</CardTitle>
        </div>
        <CardDescription>
          Scan the QR code with your authenticator app to enable two-factor authentication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <Skeleton className="w-48 h-48" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 mx-auto bg-muted rounded animate-pulse" />
          <div className="h-10 w-48 mx-auto bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
      <CardFooter>
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
      </CardFooter>
    </Card>
  );
}

export default function Setup2FAPage() {
  return (
    <Suspense fallback={<Setup2FASkeleton />}>
      <Setup2FAForm />
    </Suspense>
  );
}
