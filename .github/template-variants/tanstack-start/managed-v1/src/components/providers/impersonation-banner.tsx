import { ShieldAlert } from "lucide-react";
import { useHerculesImpersonation } from "@usehercules/auth/react";
import { Button } from "@/components/ui/button.tsx";

export function ImpersonationBanner() {
  const { isImpersonating, stopImpersonating } = useHerculesImpersonation();

  if (!isImpersonating) return null;

  return (
    <div
      role="region"
      aria-label="Impersonation controls"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-amber-300 bg-amber-50/95 py-1 pr-1 pl-3 text-sm text-amber-950 shadow-lg backdrop-blur">
        <ShieldAlert className="size-4 shrink-0" />
        <span role="status" className="truncate font-medium">
          Viewing as another user
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 rounded-full px-3"
          onClick={() => void stopImpersonating()}
        >
          Stop
        </Button>
      </div>
    </div>
  );
}
