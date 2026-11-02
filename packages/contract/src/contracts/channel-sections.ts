import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  ChannelSectionIdInputSchema,
  ChannelSectionSchema,
  CreateChannelSectionInputSchema,
  RenameChannelSectionInputSchema,
  ReorderChannelSectionsInputSchema,
} from '@/schemas/channels';

export const channelSectionErrors = {
  NOT_FOUND: { status: 404, message: 'Section not found.' },
  NAME_TAKEN: {
    status: 409,
    message: 'You already have a section with that name.',
  },
} as const;

const { NOT_FOUND, NAME_TAKEN } = channelSectionErrors;

export const listChannelSectionsContract = oc
  .meta(openapi({ method: 'GET', path: '/channel-sections' }))
  .output(z.array(ChannelSectionSchema));

export const createChannelSectionContract = oc
  .meta(openapi({ method: 'POST', path: '/channel-sections' }))
  .errors({ NAME_TAKEN })
  .input(CreateChannelSectionInputSchema)
  .output(ChannelSectionSchema);

export const renameChannelSectionContract = oc
  .meta(openapi({ method: 'PATCH', path: '/channel-sections/{sectionId}' }))
  .errors({ NOT_FOUND, NAME_TAKEN })
  .input(RenameChannelSectionInputSchema)
  .output(ChannelSectionSchema);

export const deleteChannelSectionContract = oc
  .meta(openapi({ method: 'DELETE', path: '/channel-sections/{sectionId}' }))
  .errors({ NOT_FOUND })
  .input(ChannelSectionIdInputSchema)
  .output(z.void());

export const reorderChannelSectionsContract = oc
  .meta(openapi({ method: 'PUT', path: '/channel-sections/order' }))
  .errors({ NOT_FOUND })
  .input(ReorderChannelSectionsInputSchema)
  .output(z.void());
