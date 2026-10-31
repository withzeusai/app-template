import { ConvexProviderWithHerculesAuth } from "@usehercules/auth/convex-react";
import { ConvexReactClient } from "convex/react";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL ?? "http://localhost:3000";
const convex = new ConvexReactClient(CONVEX_URL);

export default function ConvexProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithHerculesAuth client={convex}>
      {children}
    </ConvexProviderWithHerculesAuth>
  );
}
