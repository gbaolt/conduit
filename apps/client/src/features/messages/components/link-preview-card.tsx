'use client';

import type { LinkPreview } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { IconX } from '@tabler/icons-react';

const isWebUrl = (value: string) => /^https?:\/\//i.test(value);

/** What the first link in a message says about itself. The author sees a button to remove it. */
export function LinkPreviewCard({
  preview,
  onRemove,
}: {
  preview: LinkPreview;
  /** Set for the author only. */
  onRemove?: () => void;
}) {
  if (!isWebUrl(preview.url)) return null;

  return (
    <div className="group/preview relative mt-1.5 flex max-w-120 gap-3 border-l-[3px] py-0.5 pl-3">
      <a
        href={preview.url}
        target="_blank"
        rel="noopener nofollow noreferrer"
        className="flex min-w-0 flex-1 flex-col gap-0.5 outline-none focus-visible:underline"
      >
        {preview.siteName && (
          <span className="text-muted-foreground truncate text-xs">
            {preview.siteName}
          </span>
        )}
        <span className="text-primary text-sm font-semibold wrap-break-word">
          {preview.title}
        </span>
        {preview.description && (
          <span className="text-foreground/80 line-clamp-2 text-[13px]">
            {preview.description}
          </span>
        )}
      </a>
      {preview.image && isWebUrl(preview.image) && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="bg-muted size-20 shrink-0 rounded-md object-cover"
        />
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Remove link preview"
          className="absolute -top-1 -right-1 opacity-0 group-focus-within/preview:opacity-100 group-hover/preview:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100"
          onClick={onRemove}
        >
          <IconX />
        </Button>
      )}
    </div>
  );
}
