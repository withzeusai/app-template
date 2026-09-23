export interface AuthCallbackMessages {
  loading?: string;
  errorTitle?: string;
  missingState?: string;
  returnHome?: string;
  tryAgain?: string;
}

/** Pass a preset to `<AuthCallback messages={authCallbackMessages.de} />`. */
export const authCallbackMessages = {
  en: {
    loading: "Loading...",
    errorTitle: "Something went wrong",
    missingState:
      "We couldn't find this sign-in request in this browser. Please reopen the original link in your browser (for example, Safari or Chrome), not inside another app, and sign in again.",
    returnHome: "Return home",
    tryAgain: "Try again",
  },
  es: {
    loading: "Cargando...",
    errorTitle: "Algo salió mal",
    missingState:
      "No pudimos encontrar esta solicitud de inicio de sesión en este navegador. Vuelve a abrir el enlace original en tu navegador (por ejemplo, Safari o Chrome), no dentro de otra aplicación, e inicia sesión de nuevo.",
    returnHome: "Volver al inicio",
    tryAgain: "Intentar de nuevo",
  },
  fr: {
    loading: "Chargement...",
    errorTitle: "Une erreur est survenue",
    missingState:
      "Nous n'avons pas trouvé cette demande de connexion dans ce navigateur. Veuillez rouvrir le lien d'origine dans votre navigateur (par exemple, Safari ou Chrome), et non dans une autre application, puis vous connecter à nouveau.",
    returnHome: "Retour à l'accueil",
    tryAgain: "Réessayer",
  },
  de: {
    loading: "Wird geladen...",
    errorTitle: "Etwas ist schiefgelaufen",
    missingState:
      "Die Anmeldung konnte diesem Browser nicht zugeordnet werden. Bitte öffnen Sie den ursprünglichen Link erneut in Ihrem Browser (zum Beispiel Safari oder Chrome), nicht innerhalb einer anderen App, und melden Sie sich noch einmal an.",
    returnHome: "Zur Startseite",
    tryAgain: "Erneut versuchen",
  },
  pt: {
    loading: "Carregando...",
    errorTitle: "Algo deu errado",
    missingState:
      "Não foi possível encontrar esta solicitação de login neste navegador. Abra o link original novamente no seu navegador (por exemplo, Safari ou Chrome), não dentro de outro aplicativo, e faça login novamente.",
    returnHome: "Voltar ao início",
    tryAgain: "Tentar novamente",
  },
  zh: {
    loading: "加载中...",
    errorTitle: "出错了",
    missingState:
      "在此浏览器中找不到此登录请求。请在浏览器（例如 Safari 或 Chrome）中重新打开原始链接，而不是在其他应用内打开，然后重新登录。",
    returnHome: "返回首页",
    tryAgain: "重试",
  },
  ja: {
    loading: "読み込み中...",
    errorTitle: "問題が発生しました",
    missingState:
      "このブラウザでは、このサインイン要求が見つかりませんでした。ほかのアプリ内ではなく、Safari や Chrome などのブラウザで元のリンクをもう一度開き、再度サインインしてください。",
    returnHome: "ホームに戻る",
    tryAgain: "再試行",
  },
  ru: {
    loading: "Загрузка...",
    errorTitle: "Что-то пошло не так",
    missingState:
      "Не удалось найти этот запрос на вход в этом браузере. Откройте исходную ссылку заново в браузере (например, Safari или Chrome), а не внутри другого приложения, и войдите ещё раз.",
    returnHome: "На главную",
    tryAgain: "Повторить",
  },
  it: {
    loading: "Caricamento...",
    errorTitle: "Si è verificato un errore",
    missingState:
      "Non abbiamo trovato questa richiesta di accesso in questo browser. Riapri il link originale nel browser (ad esempio Safari o Chrome), non all'interno di un'altra app, ed effettua nuovamente l'accesso.",
    returnHome: "Torna alla home",
    tryAgain: "Riprova",
  },
} satisfies Record<string, AuthCallbackMessages>;
