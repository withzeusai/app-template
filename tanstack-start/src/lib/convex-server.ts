import { ConvexHttpClient } from "convex/browser";
import { getIdTokenAction } from "@usehercules/auth-tanstack";

function convexUrl(): string {
  const url = import.meta.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error("VITE_CONVEX_URL is not set.");
  }
  return url;
}

/** Fresh unauthenticated Convex client for server functions and server route handlers (loaders already have `context.convexQueryClient.serverHttpClient`). */
export function publicConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(convexUrl());
}

/** Same as {@link publicConvexClient}, authenticated with the current session's ID token when there is one; never send the token to the client. */
export async function authenticatedConvexClient(): Promise<ConvexHttpClient> {
  const client = publicConvexClient();
  const idToken = await getIdTokenAction();
  if (idToken) {
    client.setAuth(idToken);
  }
  return client;
}
