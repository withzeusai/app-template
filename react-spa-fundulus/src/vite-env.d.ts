/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Fundulus server, such as `https://cell.example.com`. */
  readonly VITE_FUNDULUS_URL?: string;
  /** The app's database on it. */
  readonly VITE_FUNDULUS_DB?: string;
}
