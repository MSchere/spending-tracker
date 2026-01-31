"use client";

import * as React from "react";

type PrivateModeContextProps = {
  isPrivate: boolean;
  togglePrivateMode: () => void;
};

const PrivateModeContext = React.createContext<PrivateModeContextProps | null>(null);

export function usePrivateMode() {
  const context = React.useContext(PrivateModeContext);
  if (!context) {
    throw new Error("usePrivateMode must be used within a PrivateModeProvider.");
  }
  return context;
}

export function PrivateModeProvider({ children }: { children: React.ReactNode }) {
  const [isPrivate, setIsPrivate] = React.useState(false);

  const togglePrivateMode = React.useCallback(() => {
    setIsPrivate((prev) => !prev);
  }, []);

  const contextValue = React.useMemo(
    () => ({
      isPrivate,
      togglePrivateMode,
    }),
    [isPrivate, togglePrivateMode]
  );

  return (
    <PrivateModeContext.Provider value={contextValue}>
      {children}
    </PrivateModeContext.Provider>
  );
}

/**
 * Utility component to display amounts - shows "****" when private mode is enabled
 */
export function PrivateAmount({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isPrivate } = usePrivateMode();

  if (isPrivate) {
    return <span className={className}>****</span>;
  }

  return <span className={className}>{children}</span>;
}
