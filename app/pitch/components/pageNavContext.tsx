"use client";

import React, { useContext } from "react";

export type PageNav = {
  currentIndex: number;
  goNext: () => void;
  goPrev: () => void;
  scrollToIndex: (i: number) => void;
  scrollTop: number;
};

export const PageNavContext = React.createContext<PageNav | null>(null);

export function usePageNav(): PageNav {
  const ctx = useContext(PageNavContext);
  if (!ctx) {
    throw new Error("usePageNav must be used within a PageNavContext provider");
  }
  return ctx;
}


