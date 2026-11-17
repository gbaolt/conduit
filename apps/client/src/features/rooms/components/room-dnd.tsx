'use client';

import { SidebarMenuItem } from '@conduit/ui/components/sidebar';
import { cn } from '@conduit/ui/lib/utils';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { SidebarItem } from '../lib/sidebar-groups';

type RoomDndDrag = { item: SidebarItem; preview: ReactNode };

const RoomDndContext = createContext<{
  accepts: (item: SidebarItem, groupId: string) => boolean;
} | null>(null);

// The mouse-up that ends a drag also fires a click. Over a row it would follow the row's link.
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  return () => window.removeEventListener('click', swallow, { capture: true });
}

/**
 * Lets the rows inside it drag onto the groups inside it. A drag only moves a row to another group, so a group
 * is the drop target and rows keep their order. Mouse only: a touch long-press already opens the row's menu,
 * and the menu holds every action a drop does.
 */
export function RoomDnd({
  accepts,
  onDrop,
  children,
}: {
  /** Whether the group takes the row. Only a group that does lights up and gets the drop. */
  accepts: (item: SidebarItem, groupId: string) => boolean;
  onDrop: (item: SidebarItem, groupId: string) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    // A press that moves less than this is still a click on the row's link.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } })
  );
  const [drag, setDrag] = useState<RoomDndDrag | null>(null);
  const restoreClick = useRef<(() => void) | null>(null);

  const end = () => {
    setDrag(null);
    // A timeout, so the listener outlives the click this mouse-up is about to fire.
    if (restoreClick.current) setTimeout(restoreClick.current);
    restoreClick.current = null;
  };

  return (
    <RoomDndContext value={{ accepts }}>
      <DndContext
        // A fixed id, or the generated one differs between the server and the client render.
        id="room-dnd"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => {
          setDrag(active.data.current as RoomDndDrag);
          restoreClick.current = swallowNextClick();
        }}
        onDragEnd={({ active, over }) => {
          end();
          const { item } = active.data.current as RoomDndDrag;
          if (over && accepts(item, String(over.id))) {
            onDrop(item, String(over.id));
          }
        }}
        onDragCancel={end}
      >
        {children}
        {drag &&
          createPortal(
            // No drop animation: it would fly the row back to where it came from, and the row has moved.
            // The overlay is sized to the dragged row, so the preview fills it.
            <DragOverlay dropAnimation={null} className="cursor-grabbing">
              <div className="bg-background text-foreground flex size-full min-w-0 scale-[1.03] items-center gap-2 rounded-md border px-2 text-sm shadow-md transition-[scale,box-shadow] duration-150 ease-out motion-reduce:scale-100 motion-reduce:transition-none starting:scale-100 starting:shadow-none [&_svg]:size-4 [&_svg]:shrink-0">
                {drag.preview}
              </div>
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </RoomDndContext>
  );
}

/**
 * A row that drags: use it where a `SidebarMenuItem` would go. `preview` is what follows the pointer.
 * Outside `RoomDnd` it is a plain row.
 */
export function RoomDndItem({
  item,
  preview,
  ref,
  className,
  onMouseDown,
  ...props
}: ComponentProps<typeof SidebarMenuItem> & {
  item: SidebarItem;
  preview: ReactNode;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: item.id,
    data: { item, preview } satisfies RoomDndDrag,
    disabled: !use(RoomDndContext),
  });

  return (
    <SidebarMenuItem
      {...props}
      ref={(node) => {
        setNodeRef(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(isDragging && 'opacity-50', className)}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        listeners?.onMouseDown?.(event);
      }}
      // A link and an avatar drag natively, which would take the mouse away from the sensor.
      onDragStart={(event) => event.preventDefault()}
    />
  );
}

/** Makes a group a drop target. `over` is true while a row the group takes is held over it. */
export function useRoomDndDrop(groupId: string) {
  const dnd = use(RoomDndContext);
  const { setNodeRef, isOver, active } = useDroppable({
    id: groupId,
    disabled: !dnd,
  });
  const item = (active?.data.current as RoomDndDrag | undefined)?.item;

  return {
    ref: setNodeRef,
    over: isOver && !!item && !!dnd?.accepts(item, groupId),
  };
}
