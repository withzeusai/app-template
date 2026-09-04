import { Link, createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";

/**
 * Placeholder private page at `/dashboard`, rendered inside the `_app` shell
 * (see `src/routes/_app.tsx`). Replace or delete it when building the real
 * app; keep new private pages in this folder.
 */
export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LayoutDashboard />
        </EmptyMedia>
        <EmptyTitle>Nothing here yet</EmptyTitle>
        <EmptyDescription>
          This is your private dashboard. Start chatting to build it out.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
