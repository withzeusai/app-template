import { convexAction } from "@convex-dev/react-query";
import { queryOptions } from "@tanstack/react-query";
import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server";

/**
 * Query options for a Convex action that work with `useSuspenseQuery` and
 * `ensureQueryData`, so an action's result can be loaded during SSR.
 *
 * `convexAction()` types its `queryFn` as possibly `skipToken`, which
 * `useSuspenseQuery` rejects. This keeps its query key (the default `queryFn`
 * set in `router.tsx` runs it as an action) but drops the skip option.
 * Actions are not reactive, so the result is cached until invalidated.
 *
 * @example
 * ```tsx
 * const weather = (city: string) =>
 *   convexActionQuery(api.weather.forecast, { city });
 *
 * export const Route = createFileRoute("/weather")({
 *   loader: ({ context }) =>
 *     context.queryClient.ensureQueryData(weather("Paris")),
 *   component: Weather,
 * });
 *
 * function Weather() {
 *   const { data } = useSuspenseQuery(weather("Paris"));
 *   return <p>{data.summary}</p>;
 * }
 * ```
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
