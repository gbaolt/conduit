import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import type { Auth, Session } from '@/auth/auth.config';

@Injectable()
export class UsersService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService<Auth>
  ) {}

  async getSession(request: Request): Promise<Session | null> {
    return this.authService.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
  }
}
