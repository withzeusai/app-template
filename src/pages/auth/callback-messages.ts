export interface AuthCallbackMessages {
  loading: string;
  errorTitle: string;
  missingState: string;
  returnHome: string;
  tryAgain: string;
}

export const authCallbackMessages = {
  en: {
    loading: "Loading...",
    errorTitle: "Something went wrong",
    missingState:
      "We couldn't find this sign-in request in this browser. Please reopen the original link in your browser (for example, Safari or Chrome), not inside another app, and sign in again.",
    returnHome: "Return home",
    tryAgain: "Try again",
  },
  de: {
    loading: "Wird geladen...",
    errorTitle: "Etwas ist schiefgelaufen",
    missingState:
      "Die Anmeldung konnte diesem Browser nicht zugeordnet werden. Bitte öffnen Sie den ursprünglichen Link erneut in Ihrem Browser (zum Beispiel Safari oder Chrome), nicht innerhalb einer anderen App, und melden Sie sich noch einmal an.",
    returnHome: "Zur Startseite",
    tryAgain: "Erneut versuchen",
  },
} satisfies Record<string, AuthCallbackMessages>;
