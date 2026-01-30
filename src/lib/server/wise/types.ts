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
 * Wise Statement Transaction
 */
export interface WiseApiTransaction {
  type: "CREDIT" | "DEBIT";
  date: string;
  amount: {
    value: number;
    currency: string;
  };
  totalFees: {
    value: number;
    currency: string;
  };
  details: {
    type: string;
    description: string;
    senderName?: string;
    senderAccount?: string;
    paymentReference?: string;
    recipient?: {
      name: string;
    };
    merchant?: {
      name: string;
      category?: string;
      categoryCode?: string;
      city?: string;
      country?: string;
    };
  };
  exchangeDetails?: {
    fromAmount: {
      value: number;
      currency: string;
    };
    toAmount: {
      value: number;
      currency: string;
    };
    rate: number;
  };
  runningBalance: {
    value: number;
    currency: string;
  };
  referenceNumber: string;
}

/**
 * Statement Response
 */
export interface WiseApiStatementResponse {
  accountHolder: {
    type: string;
    address?: {
      addressFirstLine: string;
      city: string;
      postCode: string;
      country: string;
    };
    firstName?: string;
    lastName?: string;
  };
  issuer: {
    name: string;
    firstLine: string;
    city: string;
    postCode: string;
    country: string;
  };
  transactions: WiseApiTransaction[];
  startOfStatementBalance?: {
    value: number;
    currency: string;
  };
  endOfStatementBalance?: {
    value: number;
    currency: string;
  };
  query: {
    intervalStart: string;
    intervalEnd: string;
    currency: string;
    accountId: number;
  };
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
