import type { RoutePath } from "@/router.tsx";

type Site = {
  name: string;
  tagline: string;
  ogImage: string;
  nav: Array<{ label: string; to: RoutePath }>;
};

const WEBSITE_ID = import.meta.env.VITE_HERCULES_WEBSITE_ID ?? "";

/**
 * App-wide name, tagline, link preview image, and navigation. `__root.tsx`
 * uses the name, tagline, and image for the page title and link previews.
 *
 * While the name is "Hercules App", Hercules serves the page with the app's
 * own title in its place. The default image is the preview Hercules renders
 * for the app; replace it with an absolute URL to use your own.
 */
export const site: Site = {
  name: "Hercules App",
  tagline: "An app made by https://hercules.app",
  ogImage: `https://hercules.app/og/app/${WEBSITE_ID}.png`,
  nav: [{ label: "Home", to: "/" }],
};
