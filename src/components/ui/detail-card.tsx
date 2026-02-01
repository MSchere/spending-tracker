import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";

interface DetailCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  href?: string;
  children: React.ReactNode;
}

export function DetailCard({ title, description, icon: Icon, href, children }: DetailCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />}
          <CardTitle>{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        <div className="flex-1">{children}</div>
        {href && (
          <Link href={href} className="text-sm text-primary hover:underline block mt-4">
            View details →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
