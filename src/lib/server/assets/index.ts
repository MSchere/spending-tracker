export {
  CATEGORY_DEFAULTS,
  calculateDepreciation,
  generateDepreciationSchedule,
  calculateDefaultSalvageValue,
} from "./depreciation";

export type { AssetForDepreciation, DepreciationResult } from "./depreciation";

export {
  getTangibleAssets,
  getTangibleAssetsTotals,
  getTangibleAssetById,
  createTangibleAsset,
  updateTangibleAsset,
  deleteTangibleAsset,
} from "./queries";

export type {
  TangibleAssetSummary,
  TangibleAssetsTotals,
  CreateTangibleAssetInput,
  UpdateTangibleAssetInput,
} from "./queries";
