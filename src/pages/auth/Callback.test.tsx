import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  useAuthCallback,
  type UseAuthCallbackResult,
} from "@usehercules/auth/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallback from "./Callback.tsx";
import { authCallbackMessages } from "./callback-messages.ts";

const mocks = vi.hoisted(() => {
  const callback: Pick<UseAuthCallbackResult, "status" | "error" | "retry"> = {
    status: "processing-oauth",
    error: null,
    retry: vi.fn<() => Promise<void>>(),
  };

  return {
    callback,
    backendAuthenticated: false,
    updateCurrentUser: vi.fn(),
  };
});

vi.mock("@usehercules/auth/react", () => ({
  useAuthCallback: vi.fn(() => mocks.callback),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.backendAuthenticated,
    isLoading: false,
  }),
  useMutation: () => mocks.updateCurrentUser,
}));

function CallbackRoutes(
  props: React.ComponentProps<typeof AuthCallback>,
): React.JSX.Element {
  return (
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback {...props} />} />
        <Route path="/" element={<div>App home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.callback.status = "processing-oauth";
  mocks.callback.error = null;
  mocks.backendAuthenticated = false;
  vi.mocked(mocks.callback.retry).mockReset().mockResolvedValue(undefined);
  vi.mocked(useAuthCallback).mockClear();
  mocks.updateCurrentUser.mockReset().mockResolvedValue(null);
});

describe("AuthCallback", () => {
  it.each([
    { messages: undefined, loading: "Loading..." },
    { messages: authCallbackMessages.de, loading: "Wird geladen..." },
  ])(
    "localizes loading text and its accessible label: $loading",
    ({ messages, loading }) => {
      render(<CallbackRoutes messages={messages} />);

      expect(screen.getByText(loading)).toBeInTheDocument();
      expect(screen.getByRole("status", { name: loading })).toBeInTheDocument();
      expect(mocks.callback.retry).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      messages: undefined,
      title: "Something went wrong",
      guidance: /reopen the original link in your browser/,
      home: "Return home",
      retry: "Try again",
    },
    {
      messages: authCallbackMessages.de,
      title: "Etwas ist schiefgelaufen",
      guidance: /ursprünglichen Link erneut in Ihrem Browser/,
      home: "Zur Startseite",
      retry: "Erneut versuchen",
    },
  ])(
    "explains missing browser state: $title",
    ({ messages, title, guidance, home, retry }) => {
      mocks.callback.status = "error";
      mocks.callback.error = "No matching state found in storage";

      render(<CallbackRoutes messages={messages} />);

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(guidance)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: home })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: retry })).toBeInTheDocument();
      expect(screen.queryByText(mocks.callback.error)).not.toBeInTheDocument();
      expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
      expect(mocks.callback.retry).not.toHaveBeenCalled();
    },
  );

  it("accepts app-supplied copy without changing the managed callback", () => {
    const messages = {
      loading: "Connexion en cours...",
      errorTitle: "Connexion impossible",
      missingState:
        "Rouvrez le lien dans votre navigateur et reconnectez-vous.",
      returnHome: "Accueil",
      tryAgain: "Réessayer",
    };
    const { rerender } = render(<CallbackRoutes />);

    rerender(<CallbackRoutes messages={messages} />);
    expect(screen.getByText(messages.loading)).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: messages.loading }),
    ).toBeInTheDocument();

    mocks.callback.status = "error";
    mocks.callback.error = "No matching state found in storage";
    rerender(<CallbackRoutes messages={messages} />);

    expect(screen.getByText(messages.errorTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.missingState)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.returnHome }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.tryAgain }),
    ).toBeInTheDocument();
  });

  it("preserves unrelated provider error details", () => {
    mocks.callback.status = "error";
    mocks.callback.error = "Your account has been disabled.";

    render(<CallbackRoutes messages={authCallbackMessages.de} />);

    expect(screen.getByText(mocks.callback.error)).toBeInTheDocument();
    expect(
      screen.queryByText(authCallbackMessages.de.missingState),
    ).not.toBeInTheDocument();
  });

  it("keeps retry and home actions working with translated labels", async () => {
    const user = userEvent.setup();
    mocks.callback.status = "error";
    mocks.callback.error = "No matching state found in storage";
    render(<CallbackRoutes messages={authCallbackMessages.de} />);

    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(mocks.callback.retry).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Zur Startseite" }));
    expect(screen.getByText("App home")).toBeInTheDocument();
    expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
  });

  it("preserves the backend authentication and sync callbacks", async () => {
    const { rerender } = render(
      <CallbackRoutes messages={authCallbackMessages.de} />,
    );

    expect(
      vi.mocked(useAuthCallback).mock.lastCall?.[0]?.isBackendAuthenticated,
    ).toBe(false);
    expect(mocks.updateCurrentUser).not.toHaveBeenCalled();

    mocks.backendAuthenticated = true;
    rerender(<CallbackRoutes messages={authCallbackMessages.de} />);

    const options = vi.mocked(useAuthCallback).mock.lastCall?.[0];
    expect(options?.isBackendAuthenticated).toBe(true);
    await options?.onSync?.();
    expect(mocks.updateCurrentUser).toHaveBeenCalledExactlyOnceWith();
  });

  it.each(["onSuccess", "onNoAuthParams"] as const)(
    "preserves home navigation for %s",
    (callback) => {
      render(<CallbackRoutes messages={authCallbackMessages.de} />);

      act(() => vi.mocked(useAuthCallback).mock.lastCall?.[0]?.[callback]?.());

      expect(screen.getByText("App home")).toBeInTheDocument();
      expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
      expect(mocks.callback.retry).not.toHaveBeenCalled();
    },
  );
});
