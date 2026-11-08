'use client';

import { createContext, type ReactNode, use, useState } from 'react';

import {
  type SummaryTarget,
  useSummaryRun,
} from '@/services/messages/summaries';

type SummaryControls = ReturnType<typeof useSummaryRun> & {
  target: SummaryTarget;
  /** The date range dialog, which the menu cannot own because the menu closes first. */
  pickingDate: boolean;
  setPickingDate: (picking: boolean) => void;
};

const SummaryContext = createContext<SummaryControls | null>(null);

/**
 * Holds the summary of one conversation or one thread. The header menu that asks for it and the card at the
 * end of the log that shows it sit apart, so both reach it here.
 */
export function SummaryProvider({
  target,
  children,
}: {
  target: SummaryTarget;
  children: ReactNode;
}) {
  const run = useSummaryRun(target);
  const [pickingDate, setPickingDate] = useState(false);

  return (
    <SummaryContext value={{ ...run, target, pickingDate, setPickingDate }}>
      {children}
    </SummaryContext>
  );
}

/** Null outside a provider, such as on the Saved page. */
export const useSummary = () => use(SummaryContext);
