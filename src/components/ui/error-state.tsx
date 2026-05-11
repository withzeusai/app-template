import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { AlertCircleIcon } from "lucide-react";

function ErrorState({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="error-state"
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed border-destructive/50 p-6 text-center text-balance",
        className,
      )}
      {...props}
    />
  );
}

function ErrorStateHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="error-state-header"
      className={cn("flex max-w-sm flex-col items-center gap-2", className)}
      {...props}
    />
  );
}

const errorStateMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent text-destructive",
        icon: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function ErrorStateMedia({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof errorStateMediaVariants>) {
  return (
    <div
      data-slot="error-state-media"
      data-variant={variant}
      className={cn(errorStateMediaVariants({ variant, className }))}
      {...props}
    >
      {children ?? <AlertCircleIcon />}
    </div>
  );
}

function ErrorStateTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="error-state-title"
      className={cn(
        "font-heading text-sm font-medium tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function ErrorStateDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="error-state-description"
      className={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function ErrorStateContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="error-state-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance",
        className,
      )}
      {...props}
    />
  );
}

export {
  ErrorState,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
  ErrorStateDescription,
  ErrorStateContent,
};
