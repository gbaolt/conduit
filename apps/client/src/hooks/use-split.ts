'use client';

import { parseAsString, useQueryStates } from 'nuqs';

/**
 * What the side card shows beside the page: a `thread`, or a `room` scrolled to `message`. A thread opened
 * from the split room keeps `room`, so closing the thread returns to the room.
 */
export const splitParams = {
  thread: parseAsString,
  room: parseAsString,
  message: parseAsString,
};

export const useSplit = () => useQueryStates(splitParams);
