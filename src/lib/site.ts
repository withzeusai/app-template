import type { RoutePath } from "@/router.tsx";

type Site = {
  name: string;
  tagline: string;
  nav: Array<{ label: string; to: RoutePath }>;
};

/**
 * App-wide name, tagline, and navigation. `__root.tsx` uses the name and
 * tagline for the page title and link previews.
 *
 * While the name is "Hercules App", Hercules serves the page with the app's
 * own title in its place.
 */
export const site: Site = {
  name: "Hercules App",
  tagline: "An app made by https://hercules.app",
  nav: [{ label: "Home", to: "/" }],
};
