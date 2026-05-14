import { ShieldAlert } from "lucide-react";
import { useHerculesImpersonation } from "@usehercules/auth/react";
import { Button } from "@/components/ui/button.tsx";

export function ImpersonationBanner() {
  const { isImpersonating, stopImpersonating } = useHerculesImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="sticky inset-x-0 top-0 z-50 border-b bg-amber-50 px-4 py-2 text-amber-950 shadow-sm">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="size-4 shrink-0" />
          <span className="font-medium">You are impersonating a user.</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          onClick={() => void stopImpersonating()}
        >
          Stop impersonating
        </Button>
      </div>
    </div>
  );
}
