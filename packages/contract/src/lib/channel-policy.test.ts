import { describe, expect, it } from 'vitest';

import type { WorkspaceRole } from '@/schemas/organizations';
import type { WorkspaceSettings } from '@/schemas/workspace-settings';

import {
  type ChannelAction,
  canCreateChannel,
  channelPolicy,
  checkChannel,
  type PolicyChannel,
} from './channel-policy';

type Persona = {
  role: WorkspaceRole;
  membership: PolicyChannel['membership'];
};

const joined = { starredAt: null, sectionId: null };
const personas: [string, Persona][] = [
  ['admin outside', { role: 'admin', membership: null }],
  [
    'admin inside',
    { role: 'admin', membership: { role: 'member', ...joined } },
  ],
  ['manager', { role: 'member', membership: { role: 'manager', ...joined } }],
  ['member', { role: 'member', membership: { role: 'member', ...joined } }],
  ['outsider', { role: 'member', membership: null }],
];

const channel = (overrides: Partial<PolicyChannel> = {}): PolicyChannel => ({
  visibility: 'public',
  isDefault: false,
  archivedAt: null,
  membership: null,
  ...overrides,
});

// Appendix E, one letter per persona above: y allowed, n refused.
const table: [ChannelAction, string, Partial<PolicyChannel>?][] = [
  ['view', 'yyyyy'],
  ['view', 'nyyyn', { visibility: 'private' }],
  ['rename', 'yyynn'],
  ['editDetails', 'yyyyn'],
  ['addMembers', 'nyyyn'],
  ['removeMember', 'yyynn'],
  ['setManager', 'yyynn'],
  ['archive', 'yyynn'],
  ['unarchive', 'yyynn', { archivedAt: new Date() }],
  ['makePrivate', 'yyynn'],
  ['makePublic', 'yynnn', { visibility: 'private' }],
  ['delete', 'yynnn'],
  ['join', 'yyyyy'],
  ['leave', 'nyyyn'],
  ['star', 'nyyyn'],
  ['moveToSection', 'nyyyn'],
  ['post', 'nyyyn'],
  ['deleteOthersMessages', 'yyynn'],
];

const decide = (action: ChannelAction, persona: Persona, c: PolicyChannel) =>
  checkChannel(action, persona.role, { ...c, membership: persona.membership });

describe('channelPolicy', () => {
  it('has a table row for every action', () => {
    expect(new Set(table.map(([action]) => action))).toEqual(
      new Set(Object.keys(channelPolicy))
    );
  });

  describe.each(table)('%s (%s)', (action, cells, overrides) => {
    it.each(
      personas.map(([name, p], i) => [name, p, cells[i] === 'y'] as const)
    )('%s', (_name, persona, allowed) => {
      expect(decide(action, persona, channel(overrides))).toBe(
        allowed ? null : 'FORBIDDEN'
      );
    });
  });

  it('treats owner exactly like admin', () => {
    for (const [action, , overrides] of table) {
      for (const membership of [null, personas[1]![1].membership]) {
        const c = channel({ ...overrides, membership });
        expect(checkChannel(action, 'owner', c)).toBe(
          checkChannel(action, 'admin', c)
        );
      }
    }
  });

  const locked: ChannelAction[] = [
    'leave',
    'archive',
    'delete',
    'makePrivate',
    'makePublic',
    'addMembers',
    'removeMember',
    'setManager',
  ];

  it.each(locked)('locks %s on the default channel for everyone', (action) => {
    for (const [, persona] of personas) {
      expect(decide(action, persona, channel({ isDefault: true }))).toBe(
        'DEFAULT_CHANNEL_LOCKED'
      );
    }
  });

  it('lets only admins rename the default channel', () => {
    const defaultChannel = channel({ isDefault: true });
    expect(decide('rename', personas[0]![1], defaultChannel)).toBeNull();
    expect(decide('rename', personas[3]![1], defaultChannel)).toBe('FORBIDDEN');
  });

  it('offers only the visibility switch that changes something', () => {
    const admin = personas[1]![1];
    expect(
      decide('makePrivate', admin, channel({ visibility: 'private' }))
    ).toBe('FORBIDDEN');
    expect(decide('makePublic', admin, channel())).toBe('FORBIDDEN');
  });

  it('offers unarchive only on an archived channel', () => {
    expect(decide('unarchive', personas[1]![1], channel())).toBe('FORBIDDEN');
  });

  const openWhenArchived: ChannelAction[] = [
    'view',
    'unarchive',
    'delete',
    'leave',
    'star',
  ];

  it.each(Object.keys(channelPolicy) as ChannelAction[])(
    'archived channel decides %s',
    (action) => {
      const archived = channel({ archivedAt: new Date() });
      const manager = personas[2]![1];
      if (openWhenArchived.includes(action)) {
        expect(decide(action, manager, archived)).not.toBe('CHANNEL_ARCHIVED');
      } else {
        expect(decide(action, manager, archived)).toBe('CHANNEL_ARCHIVED');
      }
    }
  );
});

describe('canCreateChannel', () => {
  const settings = (
    channelCreators: WorkspaceSettings['channelCreators'],
    publicChannelCreators: WorkspaceSettings['publicChannelCreators']
  ): WorkspaceSettings => ({ channelCreators, publicChannelCreators });

  // [channelCreators, publicChannelCreators, member public, member private]
  const combos = [
    ['everyone', 'everyone', true, true],
    ['everyone', 'admins', false, true],
    ['admins', 'everyone', false, false],
    ['admins', 'admins', false, false],
  ] as const;

  it.each(combos)(
    'channelCreators %s, publicChannelCreators %s',
    (creators, publicCreators, memberPublic, memberPrivate) => {
      const s = settings(creators, publicCreators);

      expect(canCreateChannel('member', 'public', s)).toBe(memberPublic);
      expect(canCreateChannel('member', 'private', s)).toBe(memberPrivate);
      for (const role of ['admin', 'owner'] as const) {
        expect(canCreateChannel(role, 'public', s)).toBe(true);
        expect(canCreateChannel(role, 'private', s)).toBe(true);
      }
    }
  );
});
