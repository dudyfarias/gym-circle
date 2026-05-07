"use client";

import { createContext, useContext } from "react";

type SearchSheetContextValue = {
  openSearch: () => void;
};

const SearchSheetContext = createContext<SearchSheetContextValue | null>(null);

export const SearchSheetProvider = SearchSheetContext.Provider;

export function useSearchSheet(): SearchSheetContextValue {
  return (
    useContext(SearchSheetContext) ?? {
      openSearch: () => {
        /* no-op when not provided */
      },
    }
  );
}
