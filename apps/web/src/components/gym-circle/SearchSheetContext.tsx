"use client";

import { createContext, useContext } from "react";

type UISheetContextValue = {
  openSearch: () => void;
  openProfile: (userId: string) => void;
  openEditProfile: () => void;
  openNotifications: () => void;
  unreadNotifications: number;
};

const noop = () => {
  /* default no-op */
};

const UISheetContext = createContext<UISheetContextValue>({
  openSearch: noop,
  openProfile: noop,
  openEditProfile: noop,
  openNotifications: noop,
  unreadNotifications: 0,
});

export const SearchSheetProvider = UISheetContext.Provider;

export function useSearchSheet(): UISheetContextValue {
  return useContext(UISheetContext);
}
