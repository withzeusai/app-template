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

/**
 * Lives beside `ThemeProvider` rather than in it so that `theme.tsx` exports
 * only components and keeps Fast Refresh working.
 */
export function useTheme() {
  return React.useContext(ThemeProviderContext);
}
