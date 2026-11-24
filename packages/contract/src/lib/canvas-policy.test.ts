import { describe, expect, it } from 'vitest';

import type { WorkspaceRole } from '@/schemas/organizations';

import {
  type CanvasAction,
  type CanvasViewer,
  checkCanvas,
  type PolicyCanvas,
} from './canvas-policy';
import type { PolicyChannel } from './channel-policy';

const joined = {
  starredAt: null,
  sectionId: null,
  notify: null,
  mutedAt: null,
  closedAt: null,
};

const channel = (overrides: Partial<PolicyChannel> = {}): PolicyChannel => ({
  kind: 'channel',
  visibility: 'public',
  permissions: {
    post: 'everyone',
    reply: 'everyone',
    mentionEveryone: 'everyone',
  },
  isDefault: false,
  archivedAt: null,
  membership: { role: 'member', ...joined },
  ...overrides,
});

const inChannel = (overrides: Partial<PolicyChannel> = {}): PolicyCanvas => ({
  createdById: 'author',
  channel: channel(overrides),
  membership: null,
});

const standalone = (role: 'editor' | 'viewer' | null): PolicyCanvas => ({
  createdById: 'author',
  channel: null,
  membership: role && { role },
});

const viewer = (
  workspaceRole: WorkspaceRole = 'member',
  userId = 'someone'
): CanvasViewer => ({ userId, workspaceRole });

const actions: CanvasAction[] = [
  'view',
  'edit',
  'comment',
  'manageSharing',
  'delete',
];

const results = (canvasViewer: CanvasViewer, canvas: PolicyCanvas) =>
  Object.fromEntries(
    actions.map((action) => [action, checkCanvas(action, canvasViewer, canvas)])
  );

describe('canvasPolicy', () => {
  it('lets a public channel member read and edit, but not share or delete what they did not write', () => {
    expect(results(viewer(), inChannel())).toEqual({
      view: null,
      edit: null,
      comment: null,
      manageSharing: 'FORBIDDEN',
      delete: 'FORBIDDEN',
    });
  });

  it('lets the author and a workspace admin delete a channel canvas', () => {
    expect(checkCanvas('delete', viewer('member', 'author'), inChannel())).toBe(
      null
    );
    expect(checkCanvas('delete', viewer('admin'), inChannel())).toBe(null);
  });

  it('lets someone outside a public channel read it but not edit it', () => {
    expect(results(viewer(), inChannel({ membership: null }))).toMatchObject({
      view: null,
      edit: 'FORBIDDEN',
    });
  });

  it('hides a private channel canvas from everyone outside the channel, admins included', () => {
    const canvas = inChannel({ visibility: 'private', membership: null });
    expect(checkCanvas('view', viewer(), canvas)).toBe('NOT_FOUND');
    expect(checkCanvas('edit', viewer('owner'), canvas)).toBe('NOT_FOUND');
  });

  it('leaves an archived channel canvas read-only', () => {
    expect(
      results(viewer('admin'), inChannel({ archivedAt: new Date() }))
    ).toEqual({
      view: null,
      edit: 'CHANNEL_ARCHIVED',
      comment: 'CHANNEL_ARCHIVED',
      manageSharing: 'CHANNEL_ARCHIVED',
      delete: 'CHANNEL_ARCHIVED',
    });
  });

  it('lets a standalone editor do everything', () => {
    expect(results(viewer(), standalone('editor'))).toEqual({
      view: null,
      edit: null,
      comment: null,
      manageSharing: null,
      delete: null,
    });
  });

  it('lets a standalone viewer read and comment only', () => {
    expect(results(viewer(), standalone('viewer'))).toEqual({
      view: null,
      edit: 'FORBIDDEN',
      comment: null,
      manageSharing: 'FORBIDDEN',
      delete: 'FORBIDDEN',
    });
  });

  it('hides a standalone canvas from anyone it is not shared with, admins included', () => {
    for (const role of ['member', 'admin', 'owner'] as const) {
      for (const action of actions) {
        expect(checkCanvas(action, viewer(role), standalone(null))).toBe(
          'NOT_FOUND'
        );
      }
    }
  });
});
