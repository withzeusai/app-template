import { ConvexProviderWithHerculesAuth } from "@usehercules/auth/convex-react";
import { convex } from "@/lib/convex";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithHerculesAuth client={convex}>
      {children}
    </ConvexProviderWithHerculesAuth>
  );
}
