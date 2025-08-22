import * as React from "react";

import { cn } from "@/lib/utils.ts";

const EmptyState = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="empty-state"
      className={cn(
        "flex min-h-[400px] w-full flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed p-8 text-center",
        className,
      )}
      {...props}
    />
  );
});
EmptyState.displayName = "EmptyState";

function EmptyStateIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-icon"
      className={cn(
        "text-muted-foreground flex size-12 items-center justify-center [&_svg]:size-full",
        className,
      )}
      {...props}
    />
  );
}

function EmptyStateTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-state-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function EmptyStateDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function EmptyStateContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-content"
      className={cn("flex flex-col items-center gap-2", className)}
      {...props}
    />
  );
}

function EmptyStateAction({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-action"
      className={cn("mt-2", className)}
      {...props}
    />
  );
}

export {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateContent,
  EmptyStateAction,
};
