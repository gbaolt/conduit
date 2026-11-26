import type { Canvas, CanvasDocument } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { applyCanvasUpdate } from '../hooks';

function makeCanvas(overrides: Partial<Canvas> = {}): Canvas {
  return {
    id: 'c1',
    organizationId: 'org1',
    roomId: 'r1',
    roomKind: 'channel',
    roomName: 'general',
    title: 'Original title',
    icon: '📝',
    coverPreset: 'ocean',
    createdById: 'u1',
    updatedByName: 'Alice',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    access: { edit: true, comment: true, manageSharing: true, delete: true },
    ...overrides,
  };
}

function makeDocument(overrides: Partial<CanvasDocument> = {}): CanvasDocument {
  return {
    ...makeCanvas(overrides),
    snapshotJson: { root: { children: [] } },
    markdown: 'initial body',
    ...overrides,
  };
}

describe('applyCanvasUpdate', () => {
  it('does not roll back a concurrent rename when an earlier autosave resolves later', () => {
    const cachedAfterRename = makeDocument({
      title: 'Renamed title',
      icon: '🚀',
      coverPreset: 'sunset',
      updatedAt: new Date('2026-01-01T00:01:00Z'),
    });

    const staleAutosaveResponse = makeCanvas({
      title: 'Original title',
      icon: '📝',
      coverPreset: 'ocean',
      updatedByName: 'Bob',
      updatedAt: new Date('2026-01-01T00:02:00Z'),
    });

    const nextSnapshot = { root: { children: [{ type: 'paragraph' }] } };
    const patched = applyCanvasUpdate(
      cachedAfterRename,
      staleAutosaveResponse,
      {
        canvasId: 'c1',
        snapshotJson: nextSnapshot,
        markdown: 'updated body',
      }
    );

    expect(patched.title).toBe('Renamed title');
    expect(patched.icon).toBe('🚀');
    expect(patched.coverPreset).toBe('sunset');
    expect(patched.snapshotJson).toEqual(nextSnapshot);
    expect(patched.markdown).toBe('updated body');
    expect(patched.updatedAt).toEqual(staleAutosaveResponse.updatedAt);
    expect(patched.updatedByName).toBe('Bob');
  });

  it('applies title, icon, and coverPreset updates including explicit nulls without clobbering body', () => {
    const cached = makeDocument({
      snapshotJson: { root: { version: 2 } },
      markdown: 'latest body',
    });

    const response = makeCanvas({
      title: 'Normalized Title',
      icon: null,
      coverPreset: null,
      updatedAt: new Date('2026-01-01T00:03:00Z'),
    });

    const patched = applyCanvasUpdate(cached, response, {
      canvasId: 'c1',
      title: '  Normalized Title  ',
      icon: null,
      coverPreset: null,
    });

    expect(patched.title).toBe('Normalized Title');
    expect(patched.icon).toBeNull();
    expect(patched.coverPreset).toBeNull();
    expect(patched.snapshotJson).toEqual({ root: { version: 2 } });
    expect(patched.markdown).toBe('latest body');
  });

  it('preserves room tab metadata on autosave and does not attach document-only fields', () => {
    const cachedTab = makeCanvas({ title: 'Renamed tab' });
    const staleAutosaveResponse = makeCanvas({
      title: 'Old tab',
      updatedAt: new Date('2026-01-01T00:04:00Z'),
    });

    const patchedTab = applyCanvasUpdate(cachedTab, staleAutosaveResponse, {
      canvasId: 'c1',
      snapshotJson: { root: {} },
      markdown: 'body',
    });

    expect(patchedTab.title).toBe('Renamed tab');
    expect(patchedTab.updatedAt).toEqual(staleAutosaveResponse.updatedAt);
    expect('snapshotJson' in patchedTab).toBe(false);
    expect('markdown' in patchedTab).toBe(false);
  });
});
