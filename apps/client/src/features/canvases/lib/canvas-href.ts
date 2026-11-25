import type { Canvas } from '@conduit/contract';
import type { Route } from 'next';

/** A room's canvas opens as its tab beside Messages, and a standalone canvas on its own page. */
export function canvasHref(
  canvas: Pick<Canvas, 'id' | 'roomId' | 'roomKind'>
): Route {
  if (!canvas.roomId) return `/canvases/${canvas.id}` as Route;
  const room = canvas.roomKind === 'dm' ? 'dms' : 'channels';
  return `/${room}/${canvas.roomId}?tab=${canvas.id}` as Route;
}
