import { schema, t, table } from "@usehercules/olympus/server";

export default schema(
  {
    reports: table({
      orgId: t.id("iam.organizations"),
      author: t.id("iam.users"),
      couldViewReports: t.boolean,
    }).index("by_org", ["orgId"]),
  },
  {
    permissions: {
      definitions: { "reports.read": {}, "reports.run": {} },
      operations: {
        "reports.view": ["reports.read"],
        "reports.execute": ["reports.run"],
      },
      tables: {
        reports: {
          scope: "organization",
          orgField: "orgId",
          read: "reports.view",
          create: "reports.execute",
        },
      },
    },
  },
);
