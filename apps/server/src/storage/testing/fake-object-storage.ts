import type { ObjectStorage } from '@/storage/domain/object-storage';

/** Storage in memory. `objects` holds the size a browser PUT would have stored, by key, and `bytes` any content a test set. */
export function createFakeStorage() {
  const objects = new Map<string, number>();
  const bytes = new Map<string, Uint8Array>();
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
      for (const key of keys) {
        objects.delete(key);
        bytes.delete(key);
      }
      return Promise.resolve();
    },
    read: (key) =>
      bytes.has(key)
        ? Promise.resolve(bytes.get(key)!)
        : Promise.reject(new Error(`Nothing is stored at ${key}.`)),
  };
  return { storage, objects, bytes };
}

export const fakeStorage = createFakeStorage().storage;
