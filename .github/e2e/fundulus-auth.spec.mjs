import { expect, test } from "@playwright/test";

// Runs against react-spa-fundulus's production build with a real
// fundulus-server and a mock OpenID provider (see run-spa.mjs). Every test
// signs in as the same user; the config runs them one at a time.

const USER_EMAIL = process.env.E2E_USER_EMAIL;

/**
 * Collect every message on the Fundulus sync socket, in order, as
 * `sent:<type>` and `received:<type>`. Authenticate messages say whether they
 * carry a token: `sent:Authenticate(token)` or `sent:Authenticate(null)`.
 */
function recordFundulusMessages(page) {
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
            ? `Authenticate(${message.token ? "token" : "null"})`
            : message.type;
        messages.push(`${direction}:${type}`);
      };
    socket.on("framesent", record("sent"));
    socket.on("framereceived", record("received"));
  });
  return messages;
}

/** Collect console errors and uncaught exceptions. */
function recordErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function signIn(page) {
  await page.goto("/ci-e2e");
  await page.getByTestId("sign-in").click();
  // Through the provider and /auth/callback, which stores the user's row,
  // and back.
  await page.waitForURL((url) => url.pathname === "/ci-e2e");
}

test("signing in stores the user's row, and their queries run as them", async ({
  page,
}) => {
  const messages = recordFundulusMessages(page);
  const errors = recordErrors(page);
  await signIn(page);
  await expect(page.getByTestId("current-user")).toHaveText(USER_EMAIL);

  // The callback's mutation went after the token, so it ran as the user.
  const order = messages.join(", ");
  const authenticated = messages.indexOf("sent:Authenticate(token)");
  expect.soft(authenticated, order).not.toBe(-1);
  expect
    .soft(authenticated, order)
    .toBeLessThan(messages.indexOf("sent:Mutation"));
  expect.soft(errors).toEqual([]);

  // A full reload keeps the session, and sends the token before the query.
  const reloaded = recordFundulusMessages(page);
  await page.reload();
  await expect(page.getByTestId("current-user")).toHaveText(USER_EMAIL);
  const after = reloaded.join(", ");
  expect
    .soft(reloaded.indexOf("sent:Authenticate(token)"), after)
    .toBeLessThan(reloaded.indexOf("sent:Subscribe"));
  expect(errors).toEqual([]);
});

test("a signed-out visitor sends no token", async ({ page }) => {
  const messages = recordFundulusMessages(page);
  const errors = recordErrors(page);
  await page.goto("/ci-e2e");
  await expect(page.getByTestId("sign-in")).toBeVisible();
  expect(messages).not.toContain("sent:Authenticate(token)");
  expect(errors).toEqual([]);
});

test("signing out signs the client out", async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId("current-user")).toHaveText(USER_EMAIL);
  await page.getByTestId("sign-out").click();
  await page.goto("/ci-e2e");
  await expect(page.getByTestId("sign-in")).toBeVisible();
});
