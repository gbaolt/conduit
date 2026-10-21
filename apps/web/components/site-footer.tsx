import { Brand } from '@conduit/ui/components/brand';
import type { Route } from 'next';
import Link from 'next/link';

import { SectionShell } from '@/components/section-shell';
import { getSignInUrl } from '@/lib/env';

type FooterLink = { href: string; label: string };

function isAbsoluteUrl(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

function FooterAnchor({ href, label }: FooterLink) {
  const className =
    'hover:text-foreground text-muted-foreground text-sm duration-150';

  if (isAbsoluteUrl(href)) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href as Route} className={className}>
      {label}
    </Link>
  );
}

const communityLinks: FooterLink[] = [
  { href: '#' as Route, label: 'GitHub' },
  { href: '#' as Route, label: 'Discord' },
  { href: '#' as Route, label: 'Slack' },
  { href: '#' as Route, label: 'X / Twitter' },
];

const footerLinks: { name: string; links: FooterLink[] }[] = [
  {
    name: 'Product',
    links: [
      { href: '#product' as Route, label: 'Surfaces' },
      { href: '#solutions' as Route, label: 'Solutions' },
      { href: '#pricing' as Route, label: 'Pricing' },
      { href: getSignInUrl(), label: 'Get started' },
    ],
  },
  {
    name: 'Company',
    links: [
      { href: '#company' as Route, label: 'About' },
      { href: '#' as Route, label: 'Customers' },
      { href: '#' as Route, label: 'Careers' },
      { href: '#' as Route, label: 'Partners' },
    ],
  },
  {
    name: 'Legal',
    links: [
      { href: '#' as Route, label: 'Licence' },
      { href: '#' as Route, label: 'Privacy Policy' },
      { href: '#' as Route, label: 'Terms of Service' },
      { href: '#' as Route, label: 'Cookie Policy' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <SectionShell
      as="footer"
      theme="dark"
      className="border-border/60 border-t"
    >
      <div className="mx-auto grid w-full max-w-6xl space-y-16 px-16 pt-20 pb-16 lg:grid-cols-3 lg:gap-8">
        <div className="flex flex-col gap-4 md:gap-2">
          <Link href="/" aria-label="go home">
            <Brand />
          </Link>
          <span className="text-muted-foreground text-sm">
            Manage your team&apos;s work in one place.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-12 sm:grid-cols-4 lg:col-span-2">
          {footerLinks.map((linksGroup) => (
            <div key={linksGroup.name}>
              <span className="text-sm font-medium">{linksGroup.name}</span>
              <ul className="mt-4 list-inside space-y-4">
                {linksGroup.links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <span className="text-sm font-medium">Community</span>
            <ul className="mt-4 list-inside space-y-4">
              {communityLinks.map((link) => (
                <li key={link.label}>
                  <FooterAnchor href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="via-border h-px w-full bg-linear-to-r" />
      <div className="w-full text-center">
        <span className="text-muted-foreground block py-4 text-sm">
          &copy; Conduit 2026 - All rights reserved
        </span>
      </div>
    </SectionShell>
  );
}
