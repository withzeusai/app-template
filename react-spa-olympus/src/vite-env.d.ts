/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Olympus server, such as `https://cell.example.com`. */
  readonly VITE_OLYMPUS_URL?: string;
  /** The app's database on it. */
  readonly VITE_OLYMPUS_DB?: string;
}
