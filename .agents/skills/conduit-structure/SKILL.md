---
name: conduit-structure
description: Where code lives in the Conduit monorepo and which layer may import which. Use before adding a file or folder, moving code, or starting a feature in apps/client, apps/server, or packages/contract.
---

# Conduit structure

Place every new file by the tables below. A file sits at the lowest level that every one of its callers can reach. One feature's code stays in that feature, and code that a second feature needs moves up a level. You are done when each file you added or moved matches a row, and each import follows the rules under its table.

## A feature end to end

A new feature touches the layers in this order. Each step builds on the one before it.

1. Contract. Add the procedure to `packages/contract/src/contracts/<domain>.ts`, and its zod schemas, types, and error map to `schemas/<domain>.ts`.
2. Server. Add the repository, then the service, then the controller, in `apps/server/src/<domain>/`.
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

| Path                          | Holds                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<domain>/<domain>.module.ts` | the feature module, imported by `app.module.ts`                                                                                                                                                                       |
| `<domain>/*.controller.ts`    | one method per procedure, decorated with `@Implement(contract.x)`. It chains `authorized`, then `arcjet.read` or `arcjet.write`, then `workspaceMember` for workspace-scoped procedures, and calls one service method |
| `<domain>/*.service.ts`       | business rules and permission checks. It throws contract errors through helpers such as `channelError` in `channels/channel-errors.ts`                                                                                |
| `<domain>/*.repository.ts`    | every Prisma query. It takes `PrismaService` by constructor injection and returns contract types, so Prisma rows stay inside the file                                                                                 |
| `workspaces/`                 | `WorkspaceMembersRepository`, which reads workspace membership for every feature                                                                                                                                      |
| `orpc/`                       | oRPC middleware: `authorized`, `arcjet`, and `workspaceMember`                                                                                                                                                        |
| `auth/`                       | the Better Auth config, its hooks, and the Arcjet auth middleware                                                                                                                                                     |
| `database/`                   | `PrismaService` and `DatabaseModule`                                                                                                                                                                                  |

Import rules:

- A controller imports its service. A service imports repositories. A repository imports `PrismaService`.
- Inject with `@Inject(Class)` on each constructor parameter, as every existing class does.
- Middleware gets its dependencies from the oRPC context. `workspaceMember` reads `context.workspaceMembers`, which `app.module.ts` adds to the context. Add a new middleware dependency the same way.
- Better Auth owns the `user`, `session`, `organization`, `member`, and `invitation` tables. Write to them only through Better Auth's API, which is `AuthService` or the hooks in `auth/auth.config.ts`. Repositories may read them, as `WorkspaceMembersRepository` does.
- The `prisma` export in `database/prisma.service.ts` serves code outside Nest DI: `auth/auth.config.ts`, `scripts/`, and test setup. Code inside DI injects `PrismaService`, which is the same client.

## `apps/client/src`

| Path                                 | Holds                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `app/`                               | routes: pages, layouts, and route-level loading and error files. They compose features and hold no feature logic          |
| `features/<domain>/components/`      | components that one feature uses                                                                                          |
| `features/<domain>/context/`, `lib/` | that feature's providers, hooks, and pure helpers                                                                         |
| `features/workspace/`                | the shell around the whole workspace: `WorkspaceSidebar`, the switcher, the sidebar header and nav, and the layout cookie |
| `components/`                        | components that two or more features use, such as `app-shell.tsx`, `form/`, and `async/`                                  |
| `services/<domain>/queries.ts`       | query options and keys. The server prefetch and the client `useQuery` both import them, so the cache keys match           |
| `services/<domain>/server.ts`        | `'server-only'` helpers for server components, such as `requireWorkspaces()`                                              |
| `services/<domain>/hooks.ts`         | client hooks: mutations and their cache invalidation                                                                      |
| `services/auth/client.ts`            | `authClient`                                                                                                              |
| `lib/orpc.ts`                        | the one oRPC client. It forwards cookies on the server and uses the browser link in the browser                           |
| `lib/query/hydration.tsx`            | `getQueryClient` and `HydrateClient`                                                                                      |
| `@conduit/ui/components/*`           | shadcn primitives from `packages/ui`. Compose them and leave their files unchanged                                        |

Import rules:

- Only `services/` and `features/auth` import `authClient`.
- Components reach the API through `services/`, not through `lib/orpc.ts`.
- A server component fetches inside a `<Suspense>` boundary, then wraps its children in `HydrateClient`. `app/(dashboard)/(home)/channels/[channelId]/page.tsx` is the reference.
