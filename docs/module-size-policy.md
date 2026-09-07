# Module size policy

Source files are kept at or below 200 lines. A file over the limit is either
split or listed here with the reason and its measured size.

Enforcement is by review, not by a lint rule: the limit is a design signal, and
a rule that can be silenced with a comment stops being one.

## How files are split

The original path stays as a thin composition root that re-exports the same
public API, so no consumer file changes. Extractions go to
`route-support/<feature>/` for screen code and to siblings of the original for
library code.

Two rules make that safe:

- Re-exports are explicit and named. `export *` would widen the public surface
  whenever an extracted sibling exports a helper that used to be module-private.
- Expo Router files cannot move — the path *is* the route — so those keep their
  location and default export, and only their internals move out.

## Recorded exceptions

| File | Lines | Why |
| --- | ---: | --- |
| `mobile/domain/fixtures.ts` | 1331 | Fixture data. Exempt by the global rule, which excludes generated, vendor, migration, fixture and configuration files. |
| `mobile/store/DemoOperationsRepository.ts` | 352 | Measured floor is 313 lines: the class implements one interface whose methods are each irreducible, and the remainder is the seam that keeps the demo and production repositories interchangeable. It was deliberately *not* split via an inheritance chain — that hides size behind a fragile base class rather than removing it, and the production repository's 8-link chain is the counter-example. Splitting further would mean splitting the interface. |

### Test files

These seven are over the limit and are being left as they are for now:

| File | Lines |
| --- | ---: |
| `mobile/store/__tests__/repository-runtime.test.ts` | 467 |
| `mobile/store/__tests__/fleet-availability-payouts.test.ts` | 410 |
| `mobile/store/__tests__/operations-domain.test.ts` | 251 |
| `mobile/route-support/availability/__tests__/availability-utils.test.ts` | 242 |
| `mobile/lib/offline/__tests__/operations.test.ts` | 219 |
| `mobile/features/__tests__/freight-parity-contracts.test.ts` | 219 |
| `mobile/lib/auth/__tests__/service-client.test.ts` | 204 |

A test file's length tracks the size of the surface it covers, and splitting a
suite by line count tends to separate a case from the setup that explains it.
These are listed rather than silently ignored so the decision stays visible; if
one grows because the surface grew, that is the signal to split the surface.
