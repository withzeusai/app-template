import { schema, t, table } from "@usehercules/olympus/server";

export default schema({
  users: table({
    tokenIdentifier: t.string,
    name: t.string({ optional: true }),
    email: t.string({ optional: true }),
  }).index("by_token", ["tokenIdentifier"]),
});
