import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { PushSubscriptionsService } from '@/notifications/application/push-subscriptions.service';

/** A browser belongs to the member, not to a workspace, so these procedures skip `workspaceMember`. */
@Controller()
export class PushController {
  constructor(
    @Inject(PushSubscriptionsService)
    private readonly push: PushSubscriptionsService
  ) {}

  @Implement(contract.push.subscribe)
  subscribe() {
    return implement(contract.push.subscribe)
      .use(authorized)
      .use(arcjet.write)
      .handler(({ context, input }) =>
        this.push.subscribe(context.user.id, input)
      );
  }

  @Implement(contract.push.unsubscribe)
  unsubscribe() {
    return implement(contract.push.unsubscribe)
      .use(authorized)
      .use(arcjet.write)
      .handler(({ context, input }) =>
        this.push.unsubscribe(context.user.id, input.endpoint)
      );
  }
}
