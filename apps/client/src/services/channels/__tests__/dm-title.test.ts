import { describe, expect, it } from 'vitest';

import { dmTitle, selfFirst } from '../dm-title';

const member = (userId: string, name = userId) => ({
  userId,
  name,
  image: null,
});

describe('dmTitle', () => {
  it('names the other person in a pair', () => {
    expect(
      dmTitle(
        { members: [member('me', 'Bao Le'), member('u1', 'Linh Tran')] },
        'me'
      )
    ).toBe('Linh Tran');
  });

  it('names everyone but the viewer in a group', () => {
    const members = [
      member('me', 'Bao'),
      member('u1', 'Linh'),
      member('u2', 'Cy'),
    ];

    expect(dmTitle({ members }, 'me')).toBe('Linh, Cy');
  });

  it('names the self DM with "(you)"', () => {
    expect(dmTitle({ members: [member('me', 'Bao Le')] }, 'me')).toBe(
      'Bao Le (you)'
    );
  });
});

describe('selfFirst', () => {
  const self = { id: 'self', members: [member('me')] };
  const pair = { id: 'pair', members: [member('me'), member('u1')] };
  const group = {
    id: 'group',
    members: [member('me'), member('u1'), member('u2')],
  };

  it('puts the self DM first and keeps the rest in order', () => {
    expect(selfFirst([pair, group, self], 'me').map((d) => d.id)).toEqual([
      'self',
      'pair',
      'group',
    ]);
  });

  it('leaves a list with no self DM alone', () => {
    expect(selfFirst([pair, group], 'me').map((d) => d.id)).toEqual([
      'pair',
      'group',
    ]);
  });
});
