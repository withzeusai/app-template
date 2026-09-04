/**
 * Site-wide constants: the app's name, description, and primary navigation.
 *
 * Keep constants like these here rather than next to a component. Exporting a
 * non-component value from a component module trips
 * `react-refresh/only-export-components` and breaks Fast Refresh for that
 * file; `src/lib/` modules have no such restriction.
 *
 * `__root.tsx` reads `name` and `description` for the document `<title>` and
 * Open Graph metadata, so updating them here updates every page.
 */
export const SITE = {
  name: "Hercules App",
  description: "An app made by https://hercules.app",
  /** Primary navigation. Paths must be routes that exist under `src/routes/`. */
  nav: [{ label: "Home", to: "/" }],
} as const;

export type SiteNavItem = (typeof SITE.nav)[number];
