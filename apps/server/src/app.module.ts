import { ARCJET, ArcjetModule, type ArcjetNest, shield } from '@arcjet/nest';
import { Module } from '@nestjs/common';
import { ORPCModule } from '@orpc/nest';
import { onError } from '@orpc/server';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { ActivityModule } from '@/activity/activity.module';
import { AiModule } from '@/ai/ai.module';
import { ChannelsModule } from '@/channels/channels.module';
import { DmsModule } from '@/dms/dms.module';
import { HealthController } from '@/health/presentation/health.controller';
import { auth } from '@/infrastructure/auth/auth.config';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { createORPCContext } from '@/infrastructure/orpc/context';
import { translateErrors } from '@/infrastructure/orpc/errors';
import { arcjetAuthMiddleware } from '@/infrastructure/security/auth-routes.middleware';
import { MessagesModule } from '@/messages/messages.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { OrganizationsModule } from '@/organizations/organizations.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { RoomsModule } from '@/rooms/rooms.module';
import { SummariesModule } from '@/summaries/summaries.module';
import { UsersModule } from '@/users/users.module';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    OrganizationsModule,
    AiModule,
    RoomsModule,
    ChannelsModule,
    DmsModule,
    MessagesModule,
    ActivityModule,
    NotificationsModule,
    RealtimeModule,
    SummariesModule,
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
        arcjet: ArcjetNest,
        workspaceMembers: WorkspaceMembersRepository
      ) => ({
        interceptors: [
          onError((error) => {
            console.error(error);
          }),
        ],
        clientInterceptors: [translateErrors],
        context: (executionContext: object) =>
          createORPCContext(executionContext, { arcjet, workspaceMembers }),
        plugins: [],
      }),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
