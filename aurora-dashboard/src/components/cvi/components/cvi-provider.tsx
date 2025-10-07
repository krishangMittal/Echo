"use client";

import React, { createContext, useContext, ReactNode } from 'react';

interface CVIProviderProps {
  children: ReactNode;
}

const CVIContext = createContext({});

export function CVIProvider({ children }: CVIProviderProps) {
  return (
    <CVIContext.Provider value={{}}>
      {children}
    </CVIContext.Provider>
  );
}

export function useCVI() {
  return useContext(CVIContext);
}
