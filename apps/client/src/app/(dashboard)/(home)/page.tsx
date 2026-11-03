import { DefaultChannelRedirect } from '@/features/channels/components/default-channel-redirect';

// A server redirect() here fires after the dashboard shell has streamed, so the browser reloads the whole page.
export default function HomePage() {
  return <DefaultChannelRedirect />;
}
