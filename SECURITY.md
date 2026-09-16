# Dependency provenance policy

Both template variants use `trustPolicy: no-downgrade` to reject package
resolutions with weaker publisher evidence than an earlier release. This is a
registry-metadata check, not a malware or signature-verification guarantee.

The sole exception is `semver@6.3.1`, an existing locked Babel dependency. That
legacy release was published after the provenance-bearing `semver@7.5.4`, which
triggers the history check. The exception preserves the already-locked artifact;
it does not assert that the package is vulnerability-free. It matches only that
name and version, not other semver versions or an integrity digest. Keep the
lockfiles and their integrity entries unchanged when applying this policy. Remove
the exception when the locked graph no longer needs that version, and review any
future exception separately.

CI uses pnpm 10. In pnpm 10.34.5, fresh resolutions apply this policy, but an
up-to-date frozen/headless install can skip the resolver's trust-history check.
A successful frozen install therefore does not prove that every locked package
passed this policy. Current compatibility was checked separately against public
metadata for all exact versions in both locks. A package-manager upgrade or a
separate lock-metadata verifier would be needed to enforce that check on every
future frozen CI run.

The existing release-age exceptions and dependency build permissions are
unchanged. See [pnpm's trust-policy documentation](https://pnpm.io/10.x/settings#trustpolicy)
and its [10.34.5 trust-check implementation](https://github.com/pnpm/pnpm/blob/v10.34.5/resolving/npm-resolver/src/trustChecks.ts).
