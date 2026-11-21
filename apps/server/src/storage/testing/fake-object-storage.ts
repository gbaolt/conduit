import type { ObjectStorage } from '@/storage/domain/object-storage';

/** Storage in memory. `objects` holds what a browser PUT would have stored, by key. */
export function createFakeStorage() {
  const objects = new Map<string, number>();
  const storage: ObjectStorage = {
    presignUpload: ({ key }) =>
      Promise.resolve({
        uploadUrl: `https://upload.test/${key}`,
        publicUrl: `https://cdn.test/${key}`,
      }),
    publicUrl: (key) => `https://cdn.test/${key}`,
    presignDownload: (key, { inline }) =>
      Promise.resolve(
        `https://download.test/${key}?${inline ? 'inline' : 'attachment'}`
      ),
    head: (key) =>
      Promise.resolve(objects.has(key) ? { size: objects.get(key)! } : null),
    delete: (keys) => {
      for (const key of keys) objects.delete(key);
      return Promise.resolve();
    },
  };
  return { storage, objects };
}

export const fakeStorage = createFakeStorage().storage;
