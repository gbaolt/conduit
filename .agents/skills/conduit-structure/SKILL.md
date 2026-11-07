---
name: conduit-structure
description: Where code lives in the Conduit monorepo and which layer may import which. Use before adding a file or folder, moving code, or starting a feature in apps/client, apps/server, or packages/contract.
---

# Conduit structure

Place every new file by the tables below. A file sits at the lowest level that every one of its callers can reach. One feature's code stays in that feature, and code that a second feature needs moves up a level. You are done when each file you added or moved matches a row, and each import follows the rules under its table.

## A feature end to end

A new feature touches the layers in this order. Each step builds on the one before it.

1. Contract. Add the procedure to `packages/contract/src/contracts/<domain>.ts`, and its zod schemas, types, and error map to `schemas/<domain>.ts`.
2. Server. In `apps/server/src/<domain>/`, add the port to `domain/`, its Prisma or Better Auth implementation to `infrastructure/`, the service to `application/`, and the controller to `presentation/`. Then bind the port to its implementation in `<domain>.module.ts`.
3. Client data. Add query options and hooks to `apps/client/src/services/<domain>/`.
4. Client UI. Add components to `apps/client/src/features/<domain>/` and the route to `app/`.

## `packages/contract/src`

| Path                    | Holds                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `contracts/<domain>.ts` | oRPC procedures, built contract-first with `oc`                                                   |
| `schemas/<domain>.ts`   | zod schemas, the types inferred from them, and error maps such as `channelErrors`                 |
| `lib/`                  | pure rules that both apps run, such as `channel-policy.ts` and `names.ts`, with tests beside them |

The contract is the source of truth for input validation, output types, and error codes. Both apps import these types from `@conduit/contract` and never redefine them.

## `apps/server/src`

The server follows Clean Architecture. Each feature folder holds four layers, and dependencies point inward only: `presentation/` and `infrastructure/` depend on `application/`, which depends on `domain/`.

| Path                                       | Holds                                                                                                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<domain>/<domain>.module.ts`              | the feature module, imported by `app.module.ts`. It binds each port to its implementation: `{ provide: ChannelsRepository, useClass: PrismaChannelsRepository }`                                                      |
| `<domain>/domain/*.repository.ts`          | ports for data the app owns: abstract classes that take and return contract types, such as `ChannelsRepository`                                                                                                       |
| `<domain>/domain/*.gateway.ts`             | ports for Better Auth, such as `OrganizationsGateway` and `SessionsGateway`. Methods take web `Headers`, which carry the caller's session                                                                             |
| `<domain>/domain/*-errors.ts`              | error helpers such as `channelError('NOT_FOUND')`. They build a `DomainError` from the contract's error map                                                                                                           |
| `<domain>/application/*.service.ts`        | use cases: business rules and permission checks, written against the ports. Tests beside them run against `TEST_DATABASE_URL` or a fake port                                                                          |
| `<domain>/infrastructure/prisma-*.ts`      | every Prisma query, behind a port. Prisma rows stay inside the file. A unique-constraint error becomes a `DomainError`                                                                                                |
| `<domain>/infrastructure/better-auth-*.ts` | every `AuthService` call, behind a gateway port. A known Better Auth error becomes a `DomainError`                                                                                                                    |
| `<domain>/presentation/*.controller.ts`    | one method per procedure, decorated with `@Implement(contract.x)`. It chains `authorized`, then `arcjet.read` or `arcjet.write`, then `workspaceMember` for workspace-scoped procedures, and calls one service method |
| `shared/domain/`                           | `DomainError`, which every feature's error helpers build                                                                                                                                                              |
| `workspaces/`                              | the `WorkspaceMembersRepository` port and its Prisma reader, which every feature uses for workspace membership                                                                                                        |
| `health/presentation/`                     | the health check and the root page                                                                                                                                                                                    |
| `infrastructure/auth/`                     | the Better Auth config and its hooks, the password policy, trusted origins, and the Resend client                                                                                                                     |
| `infrastructure/database/`                 | `PrismaService` and `DatabaseModule`                                                                                                                                                                                  |
| `infrastructure/orpc/`                     | the oRPC context (`context.ts`), the `authorized` and `workspaceMember` middleware, and `translateErrors`, which turns a `DomainError` into the contract's `ORPCError`                                                |
| `infrastructure/security/`                 | Arcjet: `auth-routes.middleware.ts` guards Better Auth's routes, and `procedure.middleware.ts` exports the `arcjet.read`, `arcjet.write`, and `arcjet.heavyWrite` tiers                                               |

Import rules. `apps/server/eslint.config.js` enforces the first three, so lint fails on a violation:

- `domain/` imports only `@conduit/contract`, `shared/domain/`, and other `domain/` folders. No Nest, oRPC, Express, Prisma, Better Auth, or Arcjet.
- `application/` may also import `@nestjs/common` for `@Injectable` and `@Inject`. It never imports `infrastructure/` or `presentation/`.
- `presentation/` calls services. It never imports a feature's `infrastructure/`, Prisma, or `infrastructure/database/`.
- Inject with `@Inject(Class)` on each constructor parameter, as every existing class does. A port's abstract class is its injection token.
- Throw a domain error from the helper, never an `ORPCError`. `translateErrors` runs inside the procedure client, so oRPC still matches the error against the contract's map and marks it `defined`.
- Middleware gets its dependencies from the oRPC context. `workspaceMember` reads `context.workspaceMembers`, which `createORPCContext` adds. Add a new middleware dependency the same way.
- Better Auth owns the `user`, `session`, `organization`, `member`, and `invitation` tables. Write to them only through Better Auth's API, which is an `infrastructure/better-auth-*` gateway or the hooks in `infrastructure/auth/auth.config.ts`. Prisma repositories may read them, as `PrismaWorkspaceMembersRepository` does.
- Better Auth is built at import time, outside Nest DI. Its organization hooks call `WorkspaceMembershipService`, which `auth.config.ts` builds by hand with its Prisma repository.
- The `prisma` export in `infrastructure/database/prisma.service.ts` serves code outside Nest DI: `auth.config.ts`, `scripts/`, and test setup. Code inside DI injects `PrismaService`, which is the same client.

## `apps/client/src`

| Path                                 | Holds                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                               | routes: pages, layouts, and route-level loading and error files. They compose features and hold no feature logic                                                                    |
| `features/<domain>/components/`      | components that one feature uses. An area of the domain gets a subfolder, as `workspace/components/workspace-settings/`                                                             |
| `features/<domain>/context/`, `lib/` | that feature's providers, hooks, and pure helpers                                                                                                                                   |
| `features/workspace/`                | the workspace domain: the shell (`WorkspaceSidebar`, the switcher, the sidebar header and nav, the layout cookie) and its settings                                                  |
| `components/`                        | components that two or more features use, such as `app-shell.tsx`, `form/`, and `async/`                                                                                            |
| `services/<domain>/queries.ts`       | query options and keys. The server prefetch and the client `useQuery` both import them, so the cache keys match                                                                     |
| `services/<domain>/server.ts`        | `'server-only'` helpers for server components, such as `requireWorkspaces()`                                                                                                        |
| `services/<domain>/hooks.ts`         | client hooks: mutations and their cache invalidation                                                                                                                                |
| `services/auth/client.ts`            | `authClient`                                                                                                                                                                        |
| `lib/orpc.ts`                        | the one oRPC client. It forwards cookies on the server and uses the browser link in the browser                                                                                     |
| `lib/query/hydration.tsx`            | `getQueryClient` and `HydrateClient`                                                                                                                                                |
| `@conduit/ui/components/*`           | shadcn primitives from `packages/ui`. Build every control and table from them; when one is missing, add the shadcn component to `packages/ui` first. Leave existing files unchanged |

A feature folder is a domain, not a screen. The domains are `workspace`, `channels`, `auth`, and `onboarding`. Before you add a folder under `features/`, name the domain whose data the new code shows. When that domain already has a folder, the code goes inside it: settings, dialogs, and pages of the workspace live in `features/workspace/components/<area>/`. A new top-level feature folder is a new domain, with its own `services/<domain>/` or its own flow.

Import rules:

- Only `services/` and `features/auth` import `authClient`.
- Components reach the API through `services/`, not through `lib/orpc.ts`.
- A server component fetches inside a `<Suspense>` boundary, then wraps its children in `HydrateClient`. `app/(dashboard)/(home)/channels/[channelId]/page.tsx` is the reference.
