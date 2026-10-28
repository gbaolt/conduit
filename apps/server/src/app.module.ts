import { ARCJET, ArcjetModule, type ArcjetNest, shield } from '@arcjet/nest';
import { type ExecutionContext, Module } from '@nestjs/common';
import { ORPCModule } from '@orpc/nest';
import { onError } from '@orpc/server';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';

import { DatabaseModule } from '@/database/database.module';
import { HealthController } from '@/health.controller';
import { OrganizationsController } from '@/organizations/organizations.controller';
import { OrganizationsService } from '@/organizations/organizations.service';
import { UsersController } from '@/users/users.controller';
import { UsersService } from '@/users/users.service';

import { arcjetAuthMiddleware } from './auth/arcjet.middleware';
import { auth } from './auth/auth.config';

declare module '@orpc/server' {
  interface DefaultInitialContext {
    request: Request;
    arcjet: ArcjetNest;
  }
}

declare module '@orpc/nest' {
  interface ORPCGlobalContext {
    request: Request;
    arcjet: ArcjetNest;
  }
}

@Module({
  imports: [
    DatabaseModule,
    ArcjetModule.forRoot({
      isGlobal: true,
      key: process.env.ARCJET_KEY!,
      rules: [shield({ mode: 'LIVE' })],
    }),
    AuthModule.forRootAsync({
      inject: [ARCJET],
      useFactory: (aj: ArcjetNest) => ({
        auth,
        bodyParser: {
          json: { limit: '2mb' },
          urlencoded: { limit: '2mb', extended: true },
        },
        middleware: arcjetAuthMiddleware(aj),
      }),
    }),
    ORPCModule.forRootAsync({
      inject: [ARCJET],
      useFactory: (aj: ArcjetNest) => ({
        interceptors: [
          onError((error) => {
            console.error(error);
          }),
        ],
        context: (ctx: object) => ({
          request: (ctx as ExecutionContext)
            .switchToHttp()
            .getRequest<Request>(),
          arcjet: aj,
        }),
        plugins: [],
      }),
    }),
  ],
  controllers: [HealthController, UsersController, OrganizationsController],
  providers: [UsersService, OrganizationsService],
})
export class AppModule {}
