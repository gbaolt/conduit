import type { CanvasCoverPreset } from '@conduit/contract';

/** How each cover preset looks. Dark mode deepens the gradient so the page text beside it stays readable. */
export const CANVAS_COVERS: Record<
  CanvasCoverPreset,
  { label: string; className: string }
> = {
  sunset: {
    label: 'Sunset',
    className:
      'bg-linear-to-br from-orange-300 via-rose-400 to-fuchsia-500 dark:from-orange-700 dark:via-rose-800 dark:to-fuchsia-900',
  },
  ocean: {
    label: 'Ocean',
    className:
      'bg-linear-to-br from-sky-300 via-cyan-400 to-blue-500 dark:from-sky-800 dark:via-cyan-900 dark:to-blue-950',
  },
  forest: {
    label: 'Forest',
    className:
      'bg-linear-to-br from-lime-300 via-emerald-400 to-teal-600 dark:from-lime-800 dark:via-emerald-900 dark:to-teal-950',
  },
  lavender: {
    label: 'Lavender',
    className:
      'bg-linear-to-br from-violet-200 via-purple-300 to-indigo-400 dark:from-violet-800 dark:via-purple-900 dark:to-indigo-950',
  },
  rose: {
    label: 'Rose',
    className:
      'bg-linear-to-br from-pink-200 via-rose-300 to-red-400 dark:from-pink-800 dark:via-rose-900 dark:to-red-950',
  },
  amber: {
    label: 'Amber',
    className:
      'bg-linear-to-br from-yellow-200 via-amber-300 to-orange-400 dark:from-yellow-700 dark:via-amber-800 dark:to-orange-900',
  },
  slate: {
    label: 'Slate',
    className:
      'bg-linear-to-br from-slate-300 via-gray-400 to-zinc-500 dark:from-slate-700 dark:via-gray-800 dark:to-zinc-900',
  },
  mint: {
    label: 'Mint',
    className:
      'bg-linear-to-br from-emerald-100 via-teal-200 to-cyan-300 dark:from-emerald-800 dark:via-teal-900 dark:to-cyan-950',
  },
};
