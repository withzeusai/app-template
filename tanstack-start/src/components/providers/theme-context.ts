import * as React from "react";

export type Theme = "dark" | "light" | "system";

export type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const ThemeProviderContext = React.createContext<ThemeProviderState>({
  theme: "system",
  setTheme: () => {},
});

/** Separate from `theme.tsx` so that file only exports components (Fast Refresh). */
export function useTheme() {
  return React.useContext(ThemeProviderContext);
}
