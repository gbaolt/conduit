'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { shallow, useOthers } from '@liveblocks/react';
import type { CSSProperties } from 'react';

import { UserAvatar } from '@/components/user-avatar';

const SHOWN = 3;

type Person = {
  id: string;
  name: string;
  image: string | null;
  color: string;
  canWrite: boolean;
};

/** Everyone else on the canvas, once per person however many tabs they have open, ringed in their cursor color. */
export function CanvasPresenceAvatars() {
  const people = useOthers((others) => {
    const byId = new Map<string, Person>();
    for (const { id, info, canWrite } of others) {
      const seen = byId.get(id);
      byId.set(id, { id, ...info, canWrite: canWrite || !!seen?.canWrite });
    }
    return [...byId.values()];
  }, shallowPeople);

  if (people.length === 0) return null;
  const hidden = people.slice(SHOWN);

  return (
    <div
      role="group"
      aria-label={`${people.length} ${people.length === 1 ? 'other person' : 'other people'} here`}
      className="flex items-center -space-x-1.5 pr-1"
    >
      {people.slice(0, SHOWN).map((person) => (
        <Tooltip key={person.id}>
          <TooltipTrigger
            render={
              <span
                style={{ '--presence-color': person.color } as CSSProperties}
                className="animate-canvas-pop-in ring-background rounded-full ring-2"
              />
            }
          >
            <UserAvatar
              name={person.name}
              image={person.image}
              className="size-6 ring-2 ring-(--presence-color)"
            />
          </TooltipTrigger>
          <TooltipContent>
            {person.name}
            {!person.canWrite && ' · Viewing'}
          </TooltipContent>
        </Tooltip>
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="animate-canvas-pop-in bg-muted text-muted-foreground ring-background flex size-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums ring-2" />
            }
          >
            +{hidden.length}
          </TooltipTrigger>
          <TooltipContent>
            {hidden.map((person) => person.name).join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function shallowPeople(a: Person[], b: Person[]) {
  return a.length === b.length && a.every((person, i) => shallow(person, b[i]));
}
