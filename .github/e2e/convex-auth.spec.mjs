import { expect, test } from "@playwright/test";

// Runs against the template's production build with a real local Convex
// backend and a mock OpenID provider (see run.mjs). Every test signs in as the
// same user; the config runs them one at a time.

const USER_EMAIL = process.env.E2E_USER_EMAIL;
// What `getCurrentUser` answers a caller without the session's token.
const ANONYMOUS_RESULT = "anonymous result";

/**
 * Collect the type of every message on the Convex sync socket, in order, as
 * `sent:<type>` and `received:<type>`. Authenticate messages carry their token
 * type, e.g. `sent:Authenticate(User)`.
 */
function recordConvexMessages(page) {
  const messages = [];
  page.on("websocket", (socket) => {
    if (!socket.url().includes("/sync")) return;
    const record =
      (direction) =>
      ({ payload }) => {
        let message;
        try {
          message = JSON.parse(payload.toString());
        } catch {
          return;
        }
        const type =
          message.type === "Authenticate"
            ? `Authenticate(${message.tokenType})`
            : message.type;
        messages.push(`${direction}:${type}`);
      };
    socket.on("framesent", record("sent"));
    socket.on("framereceived", record("received"));
  });
  return messages;
}

/** Collect console errors and uncaught exceptions, such as React's hydration errors. */
function recordErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/**
 * Record every text `selector` shows, from the server HTML on, so a brief
 * switch to another value fails the test even when the page recovers.
 */
async function recordTexts(page, selector) {
  await page.addInitScript((target) => {
    const seen = [];
    window.__ciE2eTexts = seen;
    new MutationObserver(() => {
      for (const element of document.querySelectorAll(target)) {
        const text = element.textContent;
        if (seen.at(-1) !== text) seen.push(text);
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }, selector);
  return () => page.evaluate(() => window.__ciE2eTexts);
}

async function signIn(page, returnTo) {
  await page.goto(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.waitForURL((url) => url.pathname === returnTo);
}

/** Wait until Convex has answered the page's queries over the socket. */
async function waitForQueryResults(messages) {
  await expect
    .poll(() => {
      const subscribed = messages.indexOf("sent:ModifyQuerySet");
      return (
        subscribed !== -1 &&
        messages.slice(subscribed).includes("received:Transition")
      );
    })
    .toBe(true);
}

test("a signed-in page keeps its server-rendered Convex data", async ({
  page,
}) => {
  await signIn(page, "/ci-e2e-private");
  const texts = await recordTexts(page, '[data-testid="current-user"]');
  const messages = recordConvexMessages(page);
  const errors = recordErrors(page);

  // A full page load: the server renders with the session, the browser hydrates.
  const response = await page.reload();
  expect(await response.text()).toContain(USER_EMAIL);
  await waitForQueryResults(messages);
  await expect(page.getByTestId("current-user")).toHaveText(USER_EMAIL);

  // Soft, so a failure reports every symptom: the queries reached Convex
  // only after the session's token, so the page never showed what a
  // signed-out query returns, and React found nothing to complain about.
  const order = messages.join(", ");
  const authenticated = messages.indexOf("sent:Authenticate(User)");
  expect.soft(authenticated, order).not.toBe(-1);
  expect
    .soft(authenticated, order)
    .toBeLessThan(messages.indexOf("sent:ModifyQuerySet"));
  expect.soft(await texts()).toEqual([USER_EMAIL]);
  expect.soft(errors).toEqual([]);
});

test("a signed-in visitor's browser-only queries run as them", async ({
  page,
}) => {
  await signIn(page, "/ci-e2e-live");
  const errors = recordErrors(page);

  await page.reload();
  await expect(page.getByTestId("live-user")).toHaveText(USER_EMAIL);
  expect(errors).toEqual([]);
});

test("a signed-out visitor's queries run without a token", async ({ page }) => {
  const messages = recordConvexMessages(page);
  const errors = recordErrors(page);

  // `expectAuth` holds every request until auth settles, and only the auth
  // provider's release lets a signed-out visitor's queries through.
  await page.goto("/ci-e2e-live");
  await expect(page.getByTestId("live-user")).toHaveText(ANONYMOUS_RESULT);
  expect(messages).toContain("sent:ModifyQuerySet");
  expect(messages).not.toContain("sent:Authenticate(User)");

  await page.goto("/ci-e2e-private");
  await expect(page.getByTestId("sign-in")).toBeVisible();
  expect(errors).toEqual([]);
});
