import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { HealthStatusSchema } from '@/schemas/health';

export const healthCheckContract = oc
  .meta(openapi({ method: 'GET', path: '/health' }))
  .output(HealthStatusSchema);
