import { convexAction } from "@convex-dev/react-query";
import { queryOptions } from "@tanstack/react-query";
import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server";

/**
 * Query options for a Convex action that `useSuspenseQuery` and
 * `ensureQueryData` accept, so its result can load during SSR. Actions are not
 * reactive, so the result is cached until invalidated.
 *
 * @example
 * loader: ({ context }) =>
 *   context.queryClient.ensureQueryData(
 *     convexActionQuery(api.weather.forecast, { city: "Paris" }),
 *   ),
 */
export function convexActionQuery<Action extends FunctionReference<"action">>(
  action: Action,
  ...args: OptionalRestArgs<Action>
) {
  // Widen to the base reference type so `convexAction` accepts the args.
  const ref: FunctionReference<"action"> = action;
  return queryOptions<FunctionReturnType<Action>>({
    queryKey: convexAction(ref, args[0]).queryKey,
    staleTime: Infinity,
  });
}
