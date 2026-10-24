import { MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/providers/theme-context.ts";
import { Button } from "@/components/ui/button.tsx";

/**
 * Toggles between light and dark. When the theme is "system", the currently
 * painted scheme (the `dark` class the provider's inline script set on
 * `<html>`) decides which side we are on, and the toggle flips to the
 * opposite explicit theme.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const resolved =
      theme === "system"
        ? document.documentElement.classList.contains("dark")
          ? "dark"
          : "light"
        : theme;

    setTheme(resolved === "dark" ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {/* CSS-only swap keeps SSR and the first client render identical. */}
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  );
}
