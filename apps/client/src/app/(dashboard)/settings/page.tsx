import { ListDesktopRedirect } from '@/components/list-view';

/** The settings menu on a phone. Wider screens show the menu beside a page, so they open Members. */
export default function SettingsPage() {
  return <ListDesktopRedirect href="/settings/members" />;
}
