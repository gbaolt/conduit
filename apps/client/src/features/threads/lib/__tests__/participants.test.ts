import { describe, expect, it } from 'vitest';

import { participantsLabel } from '../participants';

const names: Record<string, string> = { linh: 'Linh Pham', arjun: 'Arjun Rao' };
const label = (ids: string[]) =>
  participantsLabel(ids, 'me', (id) => names[id] ?? 'Former member');

describe('participantsLabel', () => {
  it('says "Just you" when only the viewer wrote', () => {
    expect(label(['me'])).toBe('Just you');
  });

  it('names the others and puts the viewer last', () => {
    expect(label(['linh', 'me'])).toBe('Linh Pham and you');
    expect(label(['me', 'linh', 'arjun'])).toBe(
      'Linh Pham, Arjun Rao, and you'
    );
  });

  it('leaves the viewer out when they did not write', () => {
    expect(label(['linh', 'arjun'])).toBe('Linh Pham and Arjun Rao');
  });

  it('names someone who left the workspace', () => {
    expect(label(['gone', 'me'])).toBe('Former member and you');
  });
});
