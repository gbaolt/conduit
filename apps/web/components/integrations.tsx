'use client';

import { CanvasRevealEffect } from '@conduit/ui/components/canvas-reveal-effect';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type ComponentType, type SVGProps, useState } from 'react';

import { getSignInUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

import { ForwardButton } from './forward-button';
import {
  ArcjetMark,
  ClaudeMark,
  MotionMark,
  NeonMark,
  PrismaMark,
  Vercel,
} from './icons';
import { SectionShell } from './section-shell';

type Framework = {
  name: string;
  Mark: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
  markClassName?: string;
  fillClassName?: string;
  colors: number[][];
  dotSize?: number;
};

const frameworks: Framework[] = [
  {
    name: 'Vercel',
    Mark: Vercel,
    markClassName: '[&_path]:stroke-[10]',
    colors: [[255, 255, 255]],
  },
  {
    name: 'Neon',
    Mark: NeonMark,
    markClassName: '[&_path]:stroke-[2.25]',
    fillClassName:
      'group-hover/canvas-card:[&_path]:fill-[#00E599] motion-reduce:[&_path]:fill-[#00E599]',
    colors: [[0, 229, 153]],
  },
  {
    name: 'Prisma',
    Mark: PrismaMark,
    markClassName: '[&_path]:stroke-[6]',
    colors: [[125, 211, 252]],
  },
  {
    name: 'Arcjet',
    Mark: ArcjetMark,
    markClassName: '[&_path]:stroke-[5] size-14',
    colors: [
      [236, 72, 153],
      [232, 121, 249],
    ],
  },
  {
    name: 'Claude',
    Mark: ClaudeMark,
    markClassName: '[&_path]:stroke-[2]',
    fillClassName:
      'group-hover/canvas-card:[&_path]:fill-[#D97757] motion-reduce:[&_path]:fill-[#D97757]',
    colors: [[217, 119, 87]],
  },
  {
    name: 'Motion',
    Mark: MotionMark,
    markClassName: 'size-14 [&_path]:stroke-[1.1]',
    colors: [[251, 191, 36]],
  },
];

export default function Integrations() {
  return (
    <SectionShell theme="dark" cutout="down" className="pt-24 md:pt-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold tracking-tight">
            Integrations
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Build with the tools you already ship
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base text-balance md:text-lg">
            Conduit keeps developer experience front-and-center with a stack
            that fits modern web and AI workflows.
          </p>
          <ForwardButton variant="ghost" href={getSignInUrl()} className="mt-6">
            All integrations
          </ForwardButton>
        </div>

        <div className="border-border/70 mx-auto mt-14 max-w-5xl border-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {frameworks.map((item) => (
              <FrameworkCard key={item.name} item={item} />
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function FrameworkCard({ item }: { item: Framework }) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const { Mark } = item;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'group/canvas-card bg-background border-border relative flex h-44 items-center justify-center overflow-hidden border-dashed sm:h-52 md:h-56',
        'border-b-2 max-sm:last:border-b-0',
        'sm:max-lg:[&:nth-last-child(-n+2)]:border-b-0',
        'lg:[&:nth-last-child(-n+3)]:border-b-0',
        'sm:border-r-2 sm:max-lg:[&:nth-child(2n)]:border-r-0',
        'lg:[&:nth-child(3n)]:border-r-0'
      )}
    >
      <AnimatePresence>
        {hovered && !reduced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 h-full w-full"
          >
            <CanvasRevealEffect
              animationSpeed={2}
              colors={item.colors}
              dotSize={item.dotSize}
              containerClassName="bg-background"
            />
            <div className="absolute inset-0 bg-black/50 [mask-image:radial-gradient(200px_at_center,white,transparent)] dark:bg-black/90" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-20 flex size-full items-center justify-center">
        <div className="ease-out-cubic transition-transform duration-500 group-hover/canvas-card:-translate-y-5 motion-reduce:translate-y-0">
          <Mark
            aria-label={item.name}
            className={cn(
              'text-foreground/70 size-12 overflow-visible [&_path]:fill-none [&_path]:stroke-current group-hover/canvas-card:[&_path]:stroke-none motion-reduce:[&_path]:stroke-none',
              item.fillClassName ??
                'group-hover/canvas-card:[&_path]:fill-white motion-reduce:[&_path]:fill-white',
              item.markClassName
            )}
          />
        </div>
        <span
          className={cn(
            'ease-out-cubic pointer-events-none absolute top-1/2 translate-y-5 text-sm font-medium text-white transition-opacity duration-500',
            reduced
              ? 'opacity-100'
              : 'opacity-0 group-hover/canvas-card:opacity-100'
          )}
        >
          {item.name}
        </span>
      </div>
    </div>
  );
}
