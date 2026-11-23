import { FILE_KINDS } from '@conduit/contract';
import { parseAsString, parseAsStringLiteral } from 'nuqs';

/** The Files page's filters, kept in the URL, as in `?room=c1&person=u2&type=image&q=pricing`. */
export const filesParams = {
  room: parseAsString.withDefault(''),
  person: parseAsString.withDefault(''),
  type: parseAsStringLiteral(FILE_KINDS),
  q: parseAsString.withDefault(''),
};
