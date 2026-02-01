"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type UserPreferences = {
  locale: string;
  currency: string;
};

type PreferencesContextProps = {
  preferences: UserPreferences;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => Promise<void>;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const PreferencesContext = React.createContext<PreferencesContextProps | null>(null);

export function usePreferences() {
  const context = React.useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider.");
  }
  return context;
}

interface PreferencesProviderProps {
  children: React.ReactNode;
  initialPreferences: UserPreferences;
}

export function PreferencesProvider({ children, initialPreferences }: PreferencesProviderProps) {
  const router = useRouter();
  const [preferences, setPreferences] = React.useState<UserPreferences>(initialPreferences);

  const updatePreferences = React.useCallback(
    async (newPreferences: Partial<UserPreferences>) => {
      const previousPreferences = preferences;
      const updated = { ...preferences, ...newPreferences };

      // Optimistic update
      setPreferences(updated);

      try {
        const response = await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPreferences),
        });

        if (!response.ok) {
          throw new Error("Failed to update preferences");
        }

        toast.success("Preferences updated");
        router.refresh();
      } catch {
        // Revert on error
        setPreferences(previousPreferences);
        toast.error("Failed to update preferences");
      }
    },
    [preferences, router]
  );

  const formatCurrency = React.useCallback(
    (amount: number, currency?: string) => {
      return amount.toLocaleString(preferences.locale, {
        style: "currency",
        currency: currency || preferences.currency,
      });
    },
    [preferences.locale, preferences.currency]
  );

  const formatDate = React.useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      return dateObj.toLocaleDateString(preferences.locale, options);
    },
    [preferences.locale]
  );

  const formatNumber = React.useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return value.toLocaleString(preferences.locale, options);
    },
    [preferences.locale]
  );

  const contextValue = React.useMemo(
    () => ({
      preferences,
      updatePreferences,
      formatCurrency,
      formatDate,
      formatNumber,
    }),
    [preferences, updatePreferences, formatCurrency, formatDate, formatNumber]
  );

  return <PreferencesContext.Provider value={contextValue}>{children}</PreferencesContext.Provider>;
}

// Available locales and currencies for the settings UI
export const AVAILABLE_LOCALES = [
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "it-IT", label: "Italian (Italy)" },
  { value: "pt-PT", label: "Portuguese (Portugal)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
] as const;

export const AVAILABLE_CURRENCIES = [
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "CHF", label: "Swiss Franc (CHF)" },
  { value: "JPY", label: "Japanese Yen (JPY)" },
  { value: "CAD", label: "Canadian Dollar (CAD)" },
  { value: "AUD", label: "Australian Dollar (AUD)" },
  { value: "BRL", label: "Brazilian Real (BRL)" },
] as const;
