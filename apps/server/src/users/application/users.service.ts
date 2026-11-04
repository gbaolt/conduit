import { Inject, Injectable } from '@nestjs/common';

import { SessionsGateway } from '@/users/domain/sessions.gateway';

@Injectable()
export class UsersService {
  constructor(
    @Inject(SessionsGateway) private readonly sessions: SessionsGateway
  ) {}

  getSession(headers: Headers) {
    return this.sessions.get(headers);
  }
}
