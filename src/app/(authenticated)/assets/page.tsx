import { auth } from "@/lib/server/auth";
import { getTangibleAssets, getTangibleAssetsTotals } from "@/lib/server/assets";
import { AssetsContent } from "./assets-content";

export default async function AssetsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [assets, totals] = await Promise.all([
    getTangibleAssets(session.user.id),
    getTangibleAssetsTotals(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tangible Assets</h1>
        <p className="text-muted-foreground">
          Track physical assets and their depreciation over time
        </p>
      </div>

      <AssetsContent initialAssets={assets} initialTotals={totals} />
    </div>
  );
}
