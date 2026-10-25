import type { RoutePath } from "@/router.tsx";

type Site = {
  name: string;
  tagline: string;
  nav: Array<{ label: string; to: RoutePath }>;
};

/** Replace the name and tagline, used for the page title and description. */
export const site: Site = {
  name: "Hercules App",
  tagline: "An app made by https://hercules.app",
  nav: [{ label: "Home", to: "/" }],
};
