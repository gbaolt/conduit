import { defaultSchema, type Options } from 'rehype-sanitize';

/**
 * What rendered Markdown may contain. `rehype-raw` is not used, so the text cannot carry HTML in the
 * first place. This list is the second wall: it drops scripts, event handlers, images, and any link
 * that is not http, https, or mailto. `span[data-mention]` is let through for a remark plugin to add,
 * because sanitizing runs after remark. Raw HTML never reaches it, so a mention cannot be forged.
 */
export const sanitizeSchema: Options = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== 'img'),
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto'] },
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ['dataMention', /^[\w-]+$/],
    ],
  },
};
