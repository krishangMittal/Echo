'use client';

import { DailyProvider } from "@daily-co/daily-react";

interface CVIProviderProps {
  children: React.ReactNode;
  callObject?: any;
}

export const CVIProvider = ({ children, callObject }: CVIProviderProps) => {
  return (
    <DailyProvider callObject={callObject}>
      {children}
    </DailyProvider>
  )
}
