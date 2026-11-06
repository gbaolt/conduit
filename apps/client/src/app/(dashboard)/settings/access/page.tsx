import { AllowedDomainsForm } from '@/features/workspace-settings/components/allowed-domains-form';
import { JoinLinkSection } from '@/features/workspace-settings/components/join-link-section';

export default function AccessPage() {
  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="join-link-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="join-link-heading" className="text-base font-semibold">
          Join link
        </h2>
        <JoinLinkSection />
      </section>
      <section
        aria-labelledby="domains-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="domains-heading" className="text-base font-semibold">
          Allowed domains
        </h2>
        <AllowedDomainsForm />
      </section>
    </div>
  );
}
