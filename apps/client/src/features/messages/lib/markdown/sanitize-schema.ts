import { defaultSchema, type Options } from 'rehype-sanitize';

/**
 * What a message may contain after Markdown becomes HTML. `rehype-raw` is not used, so a message
 * cannot carry HTML in the first place. This list is the second wall: it drops scripts, event
 * handlers, images, and any link that is not http, https, or mailto.
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
