import { ConvexReactClient } from "convex/react";

export { api } from "../../convex/_generated/api";

export const convexUrl = import.meta.env.VITE_CONVEX_URL;
export const convex = new ConvexReactClient(convexUrl);
