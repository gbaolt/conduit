import type { QueryClient } from '@tanstack/react-query';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';
import { cache } from 'react';

import { createQueryClient } from './client';

export const getQueryClient = cache(createQueryClient);

export async function HydrateClient(props: {
  children: React.ReactNode;
  client: QueryClient;
}) {
  // dehydrate() stamps Date.now(), which Next only allows once the render is known to be per-request.
  await connection();
  return (
    <HydrationBoundary state={dehydrate(props.client)}>
      {props.children}
    </HydrationBoundary>
  );
}
