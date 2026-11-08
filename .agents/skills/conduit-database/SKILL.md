---
name: conduit-database
description: How to change the Conduit database safely. Use when editing apps/server/database/schema.prisma, adding a migration or a backfill, or when a server request fails with a 500.
---

# Conduit database

The schema lives in `apps/server/database/schema.prisma`, and the migrations in `apps/server/database/migrations/`. `DATABASE_URL` in `apps/server/.env` points at the developer's shared Neon database, so every command that writes reaches real data.

## Ask before you write to a database

These commands write to a database: `prisma migrate dev`, `migrate deploy`, `migrate resolve`, `db push`, `db execute`, and every script in `apps/server/scripts/`. Before you run one, tell the user the command and the database host it will reach, and wait for their yes. Read-only commands need no approval: `prisma migrate status`, `prisma migrate diff`, and `prisma validate`.

## Change the schema

1. Edit `schema.prisma`.
2. Write the migration from a diff, which touches no database:

   ```bash
   cd apps/server
   git show origin/staging:apps/server/database/schema.prisma > "$TEMP/old.prisma"
   mkdir database/migrations/<N>_<name>
   npx prisma migrate diff --from-schema "$TEMP/old.prisma" --to-schema database/schema.prisma --script -o database/migrations/<N>_<name>/migration.sql
   ```

   `<N>` is the next two-digit number, as in `00_init`, `01_organizations`, and `10_summaries`. Prisma applies folders in text order, so the zero keeps `10_` after `09_`, and the timestamped name that `migrate dev` generates would sort among them. Keep a folder's name once it ships: every database records it in `_prisma_migrations`, and a renamed folder reads as a new migration there.

3. Read the SQL. A diff writes a rename as a drop and an add, which loses the column's data. Rewrite it as `ALTER TABLE ... RENAME COLUMN`.
4. Run `pnpm db:generate`, then `pnpm typecheck`.
5. Ship the migration in the same PR as the schema change. Every schema change goes through a migration, so `prisma db push` stays unused.

## Mapped names

The models `Room` and `RoomMember` and the enums `RoomKind` and `RoomRole` keep their old database names through `@@map`: the tables are `Channel` and `ChannelMember`. Every `roomId` field is a `channelId` column through `@map`. Raw SQL uses the database names, so a raw query whose rows reach the client aliases `"channelId" AS "roomId"`, as `src/realtime/application/live-streams.ts` does.

## Backfill data

Put a backfill in `apps/server/scripts/`, and add a `db:` script for it to `apps/server/package.json`. Make it idempotent, so a second run changes nothing. `ensureDefaultChannel` in `src/channels/infrastructure/default-channel.ts` is the reference. It uses `createMany` with `skipDuplicates`, and reads the winner's row after it loses a race.

## Debug a 500

Run `npx prisma migrate status` in `apps/server` before you read code. In November 2026, every channel request returned 500 because `01_organizations` and `02_channels` had never been applied to the dev database. Report unapplied migrations to the user, and ask before you apply them.

## Test against a database

The service tests in `apps/server/src/**/*.test.ts` run only when `TEST_DATABASE_URL` is set. Point it at a throwaway database, such as a Neon branch, and keep it off the dev database. Each test creates rows under a random id and deletes them afterward.

## Ship

A PR that adds a migration says so in the first line of its body: "Run `pnpm db:migrate-deploy` against production before this deploys." Until the migration runs, every request that touches the new schema fails.
