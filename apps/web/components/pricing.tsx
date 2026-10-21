'use client';

import { Button } from '@conduit/ui/components/button';
import { IconCheck } from '@tabler/icons-react';
import { motion, useReducedMotion } from 'motion/react';

import { SectionShell } from '@/components/section-shell';
import { getSignInUrl } from '@/lib/env';
import { easeOut, staggerContainer, viewportOnce } from '@/lib/motion';

const plans = [
  {
    name: 'Starter',
    description: 'For solo developers',
    price: '$0',
    featured: false,
    variant: 'outline' as const,
    features: [
      'Unlimited personal channels',
      'Realtime messaging',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    description: 'For ambitious founders',
    price: '$49',
    featured: true,
    variant: 'default' as const,
    features: [
      'Everything in Starter',
      'AI thread summaries',
      'Shared workspaces',
      'Priority support',
      'Custom roles',
      'Mobile access',
    ],
  },
  {
    name: 'Startup',
    description: 'For growing teams',
    price: '$99',
    featured: false,
    variant: 'outline' as const,
    features: [
      'Everything in Pro',
      'SSO-ready auth',
      'Audit-friendly history',
      'Dedicated onboarding',
      'Higher AI limits',
    ],
  },
] as const;

export default function Pricing() {
  const reduced = useReducedMotion() ?? false;

  return (
    <SectionShell
      theme="light"
      id="pricing"
      cutout="up"
      className="py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Start free. Upgrade as you scale.
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-balance md:text-lg">
            Simple pricing for channels that grow with your team.
          </p>
        </div>

        <motion.div
          className="mx-auto mt-14 grid max-w-5xl gap-4 lg:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.06, reduced)}
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              className={
                plan.featured
                  ? 'border-primary bg-card relative flex flex-col gap-8 rounded-xl border p-8 shadow-lg'
                  : 'border-border flex flex-col gap-8 rounded-2xl border p-8'
              }
              variants={{
                hidden: reduced
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: 10,
                      scale: plan.featured ? 0.98 : 1,
                    },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: reduced ? 0.2 : 0.4,
                    delay: reduced ? 0 : plan.featured ? 0.04 : 0,
                    ease: easeOut,
                  },
                },
              }}
            >
              {plan.featured && (
                <div className="bg-primary text-primary-foreground absolute top-0 right-0 translate-x-px -translate-y-px rounded-tr-xl rounded-bl-lg px-3 py-1 text-xs font-medium">
                  Popular
                </div>
              )}
              <div>
                <p className="text-lg font-medium">{plan.name}</p>
                <p className="text-muted-foreground text-sm font-medium">
                  {plan.description}
                </p>

                <div className="my-8 block text-4xl font-semibold tracking-tight">
                  {plan.price}{' '}
                  <span className="text-muted-foreground text-lg font-medium">
                    /mo
                  </span>
                </div>

                <Button
                  className="w-full"
                  variant={plan.variant}
                  nativeButton={false}
                  render={<a href={getSignInUrl()}>Get Started</a>}
                />
              </div>

              <ul className="text-muted-foreground list-outside space-y-3 text-sm">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <IconCheck className="text-foreground size-3.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionShell>
  );
}
