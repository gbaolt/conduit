import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import type { Auth } from '@/infrastructure/auth/auth.config';
import type { SessionsGateway } from '@/users/domain/sessions.gateway';

@Injectable()
export class BetterAuthSessionsGateway implements SessionsGateway {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService<Auth>
  ) {}

  get(headers: Headers) {
    return this.authService.api.getSession({ headers });
  }
}
