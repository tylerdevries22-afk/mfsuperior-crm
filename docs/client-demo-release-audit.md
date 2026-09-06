# Client demo release audit — September 5, 2026

## Scope and result

SDK 57 upgrade explicitly authorized by the owner. Audit covers the Expo client, its release workflow, and all repository branches/worktrees. One worktree exists; no stashes were present. The local `.codex/config.toml` is preserved and ignored because it contains machine-specific tool configuration.

## Repairs

- Embed public auth variables using Expo's supported static references; verify demo, production and unconfigured device environments after Babel transformation.
- Register authenticated routes directly with Expo Router. Add a home anchor for deep links and browser reloads.
- Align Expo, React Native, React, native tabs, animations and TypeScript with SDK 57. Enable iPad support. Use a browser bottom tab bar so all five Admin destinations fit on small phones.
- Render the fleet map in a sandboxed browser iframe and retain native WebView rendering. Bundle the MapLibre renderer/styles with their license so map startup does not require a CDN script download. Show fleet markers before tile downloads finish, retry slow tiles once, and explain slow loading. Validate message sources and selected marker IDs.
- Support temporary synthetic payout handles on the web; retain native secure storage and refuse production browser handles.
- Keep occupied schedule cells clickable. Preserve failed edits for correction. Reset draft forms when their record changes.
- Split affected large components into focused modules, each at most 200 lines.
- Verify iOS and Android bundles/assets plus browser entry; publish the exact checked export to EAS Update and EAS Hosting.

## Verification evidence

Self-review by the active agent. Local checks run against dirty implementation work as required by the workspace's offload exception. Mission Control's initial baseline admission was unconfirmed and has not been duplicated.

- TypeScript passes. ESLint passes with zero warnings.
- Jest: 40 suites, 320 tests passed, including route registration, payout platform boundaries, and occupied schedule cell navigation.
- Expo Doctor: 21/21 checks; Expo dependency alignment passes.
- Full SDK 57 export and native payout-asset verification pass for iOS/Android; browser entry is present.
- Browser journeys: sample Admin, Driver and Customer sign-in; role-specific tabs; fleet map with truck markers; synthetic Venmo handle save; customer quote request creation; driver pickup, intermediate stop, final delivery and receiver acknowledgment; completed delivery survives reload; sign-out returns to the demo login page.
- Published EAS update opened in Expo Go 57.0.9 on an iPhone 16 Pro simulator running iOS 18.6. Verified sample Driver sign-in, Home, Schedule, HQ with five trucks and basemap, Profile, Trip history, payment logos, and the payout editor with its keyboard open. Force-quitting Expo Go and reopening the release link restored the signed-in session. Simulator captures are retained locally under `.adaptive-context/verification/`.

Native payout saving was not verified: text input through the browser simulator mirror did not reach the field. The editor was closed without a saved change. Native Customer/Admin journeys remain unverified; their browser journeys passed. Simulator Expo Go has different login requirements and does not establish unrestricted access on physical devices.

Physical iOS/Android devices have not been exercised in this environment. The native export is build evidence, not proof of physical-device compatibility. Camera/location and external-app handoffs depend on permissions and platform support.

## Branch reconciliation

Baseline main: `de1f77dc78d71c7874cb46aed9227988ef5fa244`. Historical squash merges were identified by exact PR head SHA and by checking that each PR's merge commit is an ancestor of main. Re-merging those old tips would reintroduce superseded code.

The old mobile-optimization branch contains May-era responsive marketing/CRM layout work and build-environment handling. Main now has the later responsive marketing implementation, a persistent mobile icon rail (PR #63), refactored CRM screens, build-phase environment handling, a lazy database placeholder, and the deployed metadata origin. Preserve these newer versions when recording reconciliation.

PR #71's driver home, job-assignment workflow, notifications, and freight improvements are already represented in main. Its two merge conflicts concern assignment price persistence and newer operational notification support. Preserve those newer behaviors while integrating the branch ancestry, then squash the audited release through dev and main.

| Remote branch at audit start | Head | Evidence |
| --- | --- | --- |
| `claude/bulk-send-spinner-and-explain` | `19ed9b6c9a3a` | Squash merged in PR #65 |
| `claude/email-tracking-gaps` | `5556b4acd8ce` | Squash merged in PR #64 |
| `claude/filter-rail-tag-groups-exclude` | `10d288fbf400` | Squash merged in PR #56 |
| `claude/fix-howitworks-sticky-scroll` | `2fdc4d07090a` | Squash merged in PR #53 |
| `claude/fix-vercel-deployment-bBVsZ` | `8cc6445dc03f` | Squash merged in PR #68 |
| `claude/front-range-curated-leads` | `a1376faa7f5b` | Squash merged in PR #55 |
| `claude/hero-text-timing` | `56ad194712c7` | Squash merged in PR #62 |
| `claude/how-it-works-upgrade` | `20a67678d35e` | Squash merged in PR #57 |
| `claude/improve-header-styling-B8dwm` | `839cee2b0735` | Squash merged in PR #52 |
| `claude/inbox-auto-refresh` | `ff7e8414ee41` | Squash merged in PR #61 |
| `claude/mobile-icon-rail` | `f0c80a64b432` | Squash merged in PR #63 |
| `claude/mobile-optimization-ZIOAt` | `fe16260eced4` | Reconciled into audited source; included in PR #71 squash to dev |
| `claude/new-lead-error-handling` | `7fbb0588eb3b` | Squash merged in PR #60 |
| `claude/partner-logos-integration-o64kjt` | `c3260da6d78b` | Squash merged in PR #70 |
| `claude/pill-badges-consistent-style` | `e8b54cc34270` | Squash merged in PR #58 |
| `claude/quickadd-backlog-and-spinner` | `776ecde3316f` | Squash merged in PR #66 |
| `claude/quickadd-quota-and-cron-fix` | `d44a16d78133` | Squash merged in PR #59 |
| `claude/quirky-tesla-b3f5S` | `b1512263d08d` | Squash merged in PR #69 |
| `claude/send-skip-visibility` | `0d46a69fe13d` | Squash merged in PR #67 |
| `claude/smarter-email-validation` | `ce14bbb0a25d` | Squash merged in PR #54 |
| `codex/mobile-parity-v2` | `61380f8d6284` | Already an ancestor of main |
| `codex/update-driver-homepage-layout-and-features` | `a0075d6ad7d2` | Reconciled into audited source; included in PR #71 squash to dev |
| `main` | `de1f77dc78d7` | Already an ancestor of main |

## Distribution boundary

Expo Go loads EAS-published projects only for an owner or organization member ([Expo policy](https://expo.dev/changelog/expo-go-loading-changes-may-2026)). SDK 57 iOS development sessions also require Expo login; simulator versions are exempt from that development-login rule ([Expo announcement](https://expo.dev/changelog/expo-go-57-login)). Therefore the published EAS Go link cannot promise anonymous access on any device. The policy separately permits plain JavaScript for self-hosted updates; no self-hosted distribution or physical-device compatibility for that path has been established here. The public browser deployment supplies access without Expo membership. No tunnel or local development server is part of the final hosted deployment.

PR #71 was squash merged into `dev` as `edcb65aefae30ff34ee16b53a9fac8bf3c074205`. The reconciliation merge commits have exactly the audited release tree; they add no reverted historical source. The final map-readiness correction follows that squash.

## Published artifacts

- Public browser: https://mfsuperior-demo.expo.app (anonymous login page and sample Driver sign-in verified).
- Verified SDK 57 native update group: `69606164-e9db-40df-91b9-ba3f67f2d065`, both iOS and Android, runtime `exposdk:57.0.0`.
- EAS Hosting deployment: `y3mnq5bmun`, promoted to the public production alias.
- Release source revision: `cf94cb4fec303d8dec89606d366fc4c0add96bf5`, squash merged from dev in PR #72. [Main CI run 34007984748](https://github.com/tylerdevries22-afk/mfsuperior-crm/actions/runs/34007984748) passed all gates and published both artifacts. Subsequent audit-documentation commits do not change these bundles.
- Expo Go: `exp://u.expo.dev/b28781fa-dd92-41cd-9363-e0860729a811?runtime-version=exposdk%3A57.0.0&channel-name=demo`.
- One worktree, no stashes, no unpushed local branches, and identical dev/main source trees were verified after release promotion. Historical branch tips remain preserved.

## Dependency audit

`npm audit --omit=dev`: no high or critical findings; 13 transitive moderate findings trace to two advisories. `decode-uri-component` is inherited through Expo Router's CommonJS `query-string` dependency; its patched 0.5 release changes to ESM and cannot be substituted blindly. The `uuid` advisory is inherited through Xcode project-generation tooling, whose inspected call uses v4 rather than the affected buffer-taking functions. These remain recorded limitations; no exploit reproduction was performed. The audit's automatic suggestion downgrades Expo/Router across major versions, conflicting with the approved SDK 57 release contract.

References: [decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [UUID advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
