"use client";

import { createContext, useContext, type ReactNode } from "react";

interface BusinessStatusContextType {
  status: string;
  isDisabled: boolean;
  businessId: string;
  businessName: string;
}

const BusinessStatusContext = createContext<BusinessStatusContextType>({
  status: "active",
  isDisabled: false,
  businessId: "",
  businessName: "",
});

interface BusinessStatusProviderProps {
  status: string;
  businessId: string;
  businessName: string;
  children: ReactNode;
}

export function BusinessStatusProvider({
  status,
  businessId,
  businessName,
  children,
}: BusinessStatusProviderProps) {
  const isDisabled = status === "disabled" || status === "suspended";

  return (
    <BusinessStatusContext.Provider
      value={{ status, isDisabled, businessId, businessName }}
    >
      {children}
    </BusinessStatusContext.Provider>
  );
}

export function useBusinessStatus() {
  return useContext(BusinessStatusContext);
}
