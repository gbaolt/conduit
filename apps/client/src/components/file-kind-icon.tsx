import { type FileKind, fileKind } from '@conduit/contract';
import {
  IconFile,
  IconFileTypePdf,
  IconMovie,
  IconPhoto,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

const ICONS: Record<FileKind, ComponentType<IconProps>> = {
  image: IconPhoto,
  video: IconMovie,
  pdf: IconFileTypePdf,
  other: IconFile,
};

/** The glyph for a file's kind, so a composer chip, a file card, and the Files page agree. */
export function FileKindIcon({
  contentType,
  ...props
}: { contentType: string } & IconProps) {
  const Icon = ICONS[fileKind(contentType)];
  return <Icon aria-hidden {...props} />;
}
