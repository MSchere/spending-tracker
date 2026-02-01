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
  addAssetValuation,
} from "./queries";

export type {
  TangibleAssetWithValuations,
  TangibleAssetSummary,
  TangibleAssetsTotals,
  CreateTangibleAssetInput,
  UpdateTangibleAssetInput,
  CreateValuationInput,
} from "./queries";
