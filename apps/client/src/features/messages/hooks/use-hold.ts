import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

const HOLD_MS = 450;
/** A finger that drifts further than this is scrolling, not holding. */
const MOVE_SLOP_PX = 10;

/** Press and hold a message row on a touch screen to mark it held, which shows its actions until the next tap anywhere. Spread the result on the row. */
export function useHold<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [held, setHeld] = useState(false);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const hold = () => {
    cancel();
    setHeld(true);
    navigator.vibrate?.(10);
  };

  useEffect(() => cancel, []);

  useEffect(() => {
    if (!held) return;
    // The finger that held can still lift into a click, so only a later press counts.
    let pressed = false;
    const release = () => {
      if (pressed) setHeld(false);
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      pressed = true;
      if (!ref.current?.contains(event.target as Node)) setHeld(false);
    };
    // Inside the row, close on the click instead, so a toolbar button still gets the tap.
    const listeners = [
      ['pointerdown', onPointerDown],
      ['click', release],
      ['pointercancel', release],
    ] as const;
    for (const [type, listener] of listeners)
      document.addEventListener(type, listener, true);
    return () => {
      for (const [type, listener] of listeners)
        document.removeEventListener(type, listener, true);
    };
  }, [held]);

  return {
    ref,
    'data-held': held || undefined,
    onPointerDown(event: PointerEvent<T>) {
      if (event.pointerType !== 'touch') return;
      cancel();
      press.current = {
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(hold, HOLD_MS),
      };
    },
    onPointerMove(event: PointerEvent<T>) {
      const start = press.current;
      if (
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >
          MOVE_SLOP_PX
      )
        cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Android raises the system menu on a long press, sometimes before the timer fires.
    onContextMenu(event: MouseEvent<T>) {
      if (!press.current && !held) return;
      event.preventDefault();
      hold();
    },
  };
}
