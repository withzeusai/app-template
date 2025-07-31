import { useAuth, type AuthProviderProps } from "react-oidc-context";

const AUTH_CONFIG: AuthProviderProps = {
  authority:
    import.meta.env.HERCULES_OIDC_AUTHORITY || "https://hercules.app/api/auth",
  client_id: import.meta.env.HERCULES_OIDC_CLIENT_ID || "no_client_id",
  redirect_uri: import.meta.env.HERCULES_OIDC_REDIRECT_URI || "no_redirect_uri",
  response_type: "code",
  scope: "openid profile email",
};

export { useAuth, AUTH_CONFIG };
