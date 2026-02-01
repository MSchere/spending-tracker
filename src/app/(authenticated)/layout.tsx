import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { redirect } from "next/navigation";
import { AuthenticatedLayoutClient } from "./layout-client";

async function getUserPreferences(userId: string) {
  const preferences = await db.userPreferences.findUnique({
    where: { userId },
  });

  return preferences || { locale: "es-ES", currency: "EUR" };
}

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const preferences = await getUserPreferences(session.user.id);

  return (
    <AuthenticatedLayoutClient
      initialPreferences={{
        locale: preferences.locale,
        currency: preferences.currency,
      }}
    >
      {children}
    </AuthenticatedLayoutClient>
  );
}
