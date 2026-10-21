'use client';

import { Button } from '@conduit/ui/components/button';
import { Status, StatusIndicator } from '@conduit/ui/components/status';
import { IconArrowRight } from '@tabler/icons-react';
import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';

import { HeroCircuitBackground } from '@/components/hero-circuit-background';
import { SectionShell } from '@/components/section-shell';
import { getSignInUrl } from '@/lib/env';
import { easeOut, fadeUpBlurVariants, fadeUpVariants } from '@/lib/motion';

export default function HeroSection() {
  const reduced = useReducedMotion() ?? false;
  const variants = fadeUpVariants(reduced);

  return (
    <SectionShell theme="light" className="relative overflow-hidden pb-4">
      <HeroCircuitBackground />
      <div className="relative pt-28 md:pt-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={variants}
            >
              <Link
                href="#product"
                className="group border-border bg-background/80 mx-auto flex w-fit items-center gap-2 rounded-full border p-1 pl-4 shadow-sm transition-colors duration-300"
              >
                <Status status="maintenance" className="bg-transparent p-1">
                  <StatusIndicator />
                </Status>
                <span className="text-muted-foreground text-sm">
                  AI that keeps every channel in sync
                </span>
                <div className="bg-muted size-6 overflow-hidden rounded-full duration-500">
                  <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                    <span className="flex size-6">
                      <IconArrowRight className="m-auto size-3" />
                    </span>
                    <span className="flex size-6">
                      <IconArrowRight className="m-auto size-3" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>

            <motion.h1
              custom={0.08}
              initial="hidden"
              animate="visible"
              variants={fadeUpBlurVariants(reduced)}
              className="text-foreground mx-auto mt-8 text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl"
            >
              <span className="text-transparent [filter:drop-shadow(0_0_10px_color-mix(in_oklch,var(--primary)_55%,transparent))_drop-shadow(0_0_24px_color-mix(in_oklch,var(--primary)_12%,transparent))] [-webkit-text-stroke:1.5px_var(--primary)]">
                AI-ready
              </span>{' '}
              home for team communication
            </motion.h1>

            <motion.p
              custom={0.14}
              initial="hidden"
              animate="visible"
              variants={variants}
              className="text-muted-foreground mx-auto mt-5 max-w-xl text-base font-medium text-balance md:text-lg"
            >
              Channels, threads, and realtime presence - with AI that keeps your
              team aligned.
            </motion.p>

            <motion.div
              custom={0.2}
              initial="hidden"
              animate="visible"
              variants={variants}
              className="mt-8 flex items-center justify-center gap-3"
            >
              <Button
                nativeButton={false}
                render={
                  <a href={getSignInUrl()}>
                    <span className="text-nowrap">Get started</span>
                  </a>
                }
              />
              <Button
                variant="outline"
                nativeButton={false}
                className="btn-outline"
                render={
                  <Link href="#product">
                    <span className="text-nowrap">View product</span>
                  </Link>
                }
              />
            </motion.div>
          </div>

          <motion.div
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }
            }
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: reduced ? 0.2 : 0.65,
              delay: reduced ? 0 : 0.28,
              ease: easeOut,
            }}
            className="relative mx-auto mt-14 max-w-5xl pb-10 md:mt-20 md:pb-14"
          >
            <div className="border-border from-muted/40 to-background relative overflow-hidden rounded-2xl border bg-linear-to-b p-2 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.28)]">
              <div className="overflow-hidden rounded-[10px] ring-1 ring-black/5">
                <Image
                  className="bg-background relative aspect-15/8 w-full object-cover"
                  src="/images/mail2.webp"
                  alt="Conduit workspace with channels and threads"
                  width={2700}
                  height={1440}
                  priority
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </SectionShell>
  );
}
