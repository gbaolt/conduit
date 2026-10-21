'use client';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import { IconAt } from '@tabler/icons-react';
import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';

import { ForwardButton } from '@/components/forward-button';
import { SectionShell } from '@/components/section-shell';
import { fadeUpVariants } from '@/lib/motion';

const avatars = [
  {
    alt: 'Avatar 01',
    src: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=72',
  },
  {
    alt: 'Avatar 02',
    src: 'https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?q=80&w=72',
  },
  {
    alt: 'Avatar 03',
    src: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=72',
  },
  {
    alt: 'Avatar 04',
    src: 'https://images.unsplash.com/photo-1610216705422-caa3fcb6d158?q=80&w=72',
  },
] as const;

export default function CallToAction() {
  const reduced = useReducedMotion() ?? false;
  const variants = fadeUpVariants(reduced);

  return (
    <SectionShell theme="dark" cutout="down" className="py-24 md:py-32">
      <div className="mx-auto max-w-3xl space-y-2 px-6 text-center">
        <motion.h2
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={variants}
          className="text-center text-2xl font-semibold tracking-tight md:text-4xl"
        >
          Subscribe to our newsletter
        </motion.h2>
        <motion.p
          custom={0.08}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={variants}
          className="text-muted-foreground text-center text-sm text-balance md:text-base"
        >
          Get the latest updates and insights about Conduit, delivered right to
          your inbox.
        </motion.p>
        <motion.div
          custom={0.14}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={variants}
          className="flex items-center justify-center gap-2 py-2"
        >
          <InputGroup className="bg-card max-w-xs">
            <InputGroupInput placeholder="Enter your email" />
            <InputGroupAddon>
              <IconAt data-icon="inline-start" />
            </InputGroupAddon>
          </InputGroup>

          <ForwardButton variant="default" href="#">
            Subscribe
          </ForwardButton>
        </motion.div>
        <motion.div
          custom={0.14}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={variants}
          className="flex items-center justify-center gap-2"
        >
          <p className="text-muted-foreground text-sm">
            Written by{' '}
            <span className="text-foreground font-medium">real humans</span> (we
            swear).
          </p>
          <div className="*:ring-background flex -space-x-[0.45rem] *:rounded-full *:ring-2">
            {avatars.map((avatar) => (
              <Image
                key={avatar.src}
                alt={avatar.alt}
                height={24}
                src={avatar.src}
                width={24}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </SectionShell>
  );
}
