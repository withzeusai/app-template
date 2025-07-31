import { useAuth, type AuthProviderProps } from "react-oidc-context";

const AUTH_CONFIG: AuthProviderProps = {
  authority: import.meta.env.VITE_HERCULES_OIDC_AUTHORITY!,
  client_id: import.meta.env.VITE_HERCULES_OIDC_CLIENT_ID!,
  redirect_uri: import.meta.env.VITE_HERCULES_OIDC_REDIRECT_URI!,
  response_type: "code",
  scope: "openid profile email",
};

export { useAuth, AUTH_CONFIG };
