import {
  Component,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  useMutation,
  useOlympus,
  useOlympusAuth,
  useQuery,
} from "@usehercules/olympus/react";
import { api } from "@/backend/.olympus/api";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin";

class DirectoryError extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return <p role="alert">The directory is unavailable for this account.</p>;
    return this.props.children;
  }
}

type Selection = { _id: string; name: string };

function OrganizationPicker({ select }: { select: (org: Selection) => void }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const page = useQuery(api.directory.organizations, { cursor, limit: 20 });
  if (!page) return <p role="status">Loading organizations…</p>;
  return (
    <>
      <h2>Choose an organization</h2>
      {page.items.length === 0 && <p>No organizations on this page.</p>}
      <ul>
        {page.items.map((org) => (
          <li key={org._id}>
            <Button variant="link" onClick={() => select(org)}>
              {org.name}
            </Button>
          </li>
        ))}
      </ul>
      {cursor !== null && (
        <Button variant="outline" onClick={() => setCursor(null)}>
          First page
        </Button>
      )}
      {page.cursor !== null && (
        <Button variant="outline" onClick={() => setCursor(page.cursor)}>
          Next page
        </Button>
      )}
    </>
  );
}

function GroupOwner({ org, group }: { org: string; group: string }) {
  const page = useQuery(api.directory.group, { org, group });
  return (
    <p>
      {page ? `Group owner: ${page.items[0].owner}` : "Loading group owner…"}
    </p>
  );
}

function RecentReports() {
  const rows = useQuery(api.reports.recent);
  if (!rows) return <p role="status">Loading reports…</p>;
  if (!rows.length) return <p>No access reports yet.</p>;
  return (
    <ul>
      {rows.map((row) => (
        <li key={row._id}>
          {row.author} could {row.couldViewReports ? "view" : "not view"}{" "}
          reports at {new Date(row._createdAt).toLocaleString()}.
        </li>
      ))}
    </ul>
  );
}

function OrganizationAccess({ org }: { org: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const access = useQuery(api.reports.access);
  const run = useMutation(api.reports.run);
  const [result, setResult] = useState("");
  async function runReport() {
    try {
      await run();
      setResult("Access report saved.");
    } catch {
      setResult("The report could not be saved.");
    }
  }
  const page = useQuery(api.directory.sources, { org, cursor, limit: 20 });
  if (!access || !page) return <p role="status">Loading access…</p>;
  return (
    <>
      <h2>Your report permissions</h2>
      <p>View reports: {access.view ? "Allowed" : "Denied"}</p>
      <p>Run reports: {access.run ? "Allowed" : "Denied"}</p>
      {access.run && <Button onClick={runReport}>Run access report</Button>}
      {result && <p role="status">{result}</p>}
      {access.view && <RecentReports />}
      <h2>Grant sources</h2>
      <ul>
        {page.items.map((source) => (
          <li key={source.id}>
            {source.kind === "user" ? "Direct grants" : source.name}:{" "}
            {source.permissions.join(", ")}
            {source.kind === "group" && source.canViewGroup && (
              <>
                <Button variant="link" onClick={() => setGroup(source.id)}>
                  View group owner
                </Button>
                {group === source.id && (
                  <DirectoryError>
                    <GroupOwner org={org} group={group} />
                  </DirectoryError>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {cursor !== null && (
        <Button variant="outline" onClick={() => setCursor(null)}>
          First page
        </Button>
      )}
      {page.cursor !== null && (
        <Button variant="outline" onClick={() => setCursor(page.cursor)}>
          Next page
        </Button>
      )}
    </>
  );
}

function SignedIn() {
  const client = useOlympus();
  const [selected, setSelected] = useState<Selection | null>(null);
  useEffect(() => () => client.setOrganization(null), [client]);
  function choose(org: Selection) {
    setSelected(org);
    client.setOrganization(org._id);
  }
  const organization = useSyncExternalStore(
    (changed) => client.onOrganizationChange(changed),
    () => client.organization,
  );
  return (
    <>
      {organization && (
        <header>
          <h2>
            {selected?._id === organization ? selected.name : organization}
          </h2>
          <Button
            variant="outline"
            onClick={() => client.setOrganization(null)}
          >
            Switch organization
          </Button>
        </header>
      )}
      <DirectoryError key={organization}>
        {organization ? (
          <OrganizationAccess org={organization} />
        ) : (
          <OrganizationPicker select={choose} />
        )}
      </DirectoryError>
    </>
  );
}

export default function Index() {
  const { isAuthenticated, isLoading } = useOlympusAuth();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-3xl font-semibold">Organization access</h1>
      <SignInButton />
      {isLoading ? (
        <p role="status">Checking account…</p>
      ) : (
        isAuthenticated && <SignedIn />
      )}
    </main>
  );
}
