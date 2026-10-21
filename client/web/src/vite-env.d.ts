// The build-time settings the client reads from import.meta.env (Vite's .env files).
interface ImportMetaEnv {
  /** The API's origin, when it isn't the page's own (empty: same origin, behind nginx). */
  readonly VITE_API_URL?: string;
}
