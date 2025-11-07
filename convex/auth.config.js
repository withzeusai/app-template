export default {
  providers: [
    {
      domain: process.env.HERCULES_OIDC_AUTHORITY ?? "https://hercules.app",
      applicationID: process.env.HERCULES_OIDC_CLIENT_ID,
    },
  ],
};
