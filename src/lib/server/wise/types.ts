// =============================================================================
// Wise API Types
// Based on Wise API documentation: https://docs.wise.com/api-docs/
// =============================================================================

/**
 * Wise Profile (Personal or Business)
 */
export interface WiseApiProfile {
  id: number;
  type: "PERSONAL" | "BUSINESS";
  details: {
    firstName?: string;
    lastName?: string;
    name?: string;
  };
}

/**
 * Wise Balance Account
 */
export interface WiseApiBalance {
  id: number;
  balanceType: "STANDARD" | "SAVINGS";
  currency: string;
  amount: {
    value: number;
    currency: string;
  };
  reservedAmount: {
    value: number;
    currency: string;
  };
  cashAmount: {
    value: number;
    currency: string;
  };
  totalWorth: {
    value: number;
    currency: string;
  };
  creationTime: string;
  modificationTime: string;
}

/**
 * Exchange Rate
 */
export interface WiseApiExchangeRate {
  rate: number;
  source: string;
  target: string;
  time: string;
}

/**
 * Error response from Wise API
 */
export interface WiseApiError {
  error?: string;
  message?: string;
  errors?: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
}

// =============================================================================
// Activity API Types (alternative to Balance Statements for read-only tokens)
// =============================================================================

/**
 * Activity resource reference
 */
export interface WiseApiActivityResource {
  id: number;
  type: string;
}

/**
 * Activity from the Activity API
 */
export interface WiseApiActivity {
  id: string;
  type:
    | "CARD_PAYMENT"
    | "BALANCE_DEPOSIT"
    | "TRANSFER"
    | "DIRECT_DEBIT"
    | "CONVERSION"
    | "BALANCE_ADJUSTMENT"
    | "AUTO_CONVERSION"
    | string;
  resource: WiseApiActivityResource;
  title: string;
  description: string;
  primaryAmount: string; // e.g. "150 JPY"
  secondaryAmount: string; // e.g. "1.50 SGD"
  status: "REQUIRES_ATTENTION" | "IN_PROGRESS" | "UPCOMING" | "COMPLETED" | "CANCELLED";
  createdOn: string;
  updatedOn: string;
}

/**
 * Activity list response
 */
export interface WiseApiActivityResponse {
  cursor: string | null;
  activities: WiseApiActivity[];
}
