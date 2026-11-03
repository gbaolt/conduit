import { ARCJET, ArcjetModule, type ArcjetNest, shield } from '@arcjet/nest';
import { type ExecutionContext, Module } from '@nestjs/common';
import { ORPCModule } from '@orpc/nest';
import { onError } from '@orpc/server';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';

import { ChannelsModule } from '@/channels/channels.module';
import { DatabaseModule } from '@/database/database.module';
import { HealthController } from '@/health.controller';
import { OrganizationsModule } from '@/organizations/organizations.module';
import { UsersModule } from '@/users/users.module';
import { WorkspaceMembersRepository } from '@/workspaces/workspace-members.repository';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { arcjetAuthMiddleware } from './auth/arcjet.middleware';
import { auth } from './auth/auth.config';

declare module '@orpc/server' {
  interface DefaultInitialContext {
    request: Request;
    arcjet: ArcjetNest;
    workspaceMembers: WorkspaceMembersRepository;
  }
}

declare module '@orpc/nest' {
  interface ORPCGlobalContext {
    request: Request;
    arcjet: ArcjetNest;
    workspaceMembers: WorkspaceMembersRepository;
  }
}

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    OrganizationsModule,
    ChannelsModule,
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
      imports: [WorkspacesModule],
      inject: [ARCJET, WorkspaceMembersRepository],
      useFactory: (
        aj: ArcjetNest,
        workspaceMembers: WorkspaceMembersRepository
      ) => ({
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
          workspaceMembers,
        }),
        plugins: [],
      }),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
