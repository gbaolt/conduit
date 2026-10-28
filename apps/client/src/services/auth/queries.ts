import { orpc } from '@/lib/orpc';

export const sessionQuery = orpc.users.getSession.queryOptions();
