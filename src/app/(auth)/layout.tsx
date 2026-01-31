import { PiggyBank } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <PiggyBank className="h-8 w-8" />
          <span className="font-semibold text-2xl">Spending Tracker</span>
        </div>
        {children}
      </div>
    </div>
  );
}
