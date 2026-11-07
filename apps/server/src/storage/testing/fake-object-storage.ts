import type { ObjectStorage } from '@/storage/domain/object-storage';

export const fakeStorage: ObjectStorage = {
  presignUpload: ({ key }) =>
    Promise.resolve({
      uploadUrl: `https://upload.test/${key}`,
      publicUrl: `https://cdn.test/${key}`,
    }),
  publicUrl: (key) => `https://cdn.test/${key}`,
};
