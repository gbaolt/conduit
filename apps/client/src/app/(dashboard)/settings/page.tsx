import { DesktopRedirect } from '@/components/list-view';

/** The settings menu on a phone. Wider screens show the menu beside a page, so they open Members. */
export default function SettingsPage() {
  return <DesktopRedirect href="/settings/members" />;
}
