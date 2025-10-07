"use client";

import { DailyProvider } from "@daily-co/daily-react";

interface DailyProviderWrapperProps {
  children: React.ReactNode;
}

export function DailyProviderWrapper({ children }: DailyProviderWrapperProps) {
  return (
    <DailyProvider>
      {children}
    </DailyProvider>
  );
}