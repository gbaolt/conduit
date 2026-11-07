import { AllowedDomainsForm } from '@/features/workspace/components/workspace-settings/allowed-domains-form';
import { JoinLinkSection } from '@/features/workspace/components/workspace-settings/join-link-section';
import {
  SettingsHeader,
  SettingsSection,
} from '@/features/workspace/components/workspace-settings/settings-view';

export default function AccessPage() {
  return (
    <>
      <SettingsHeader
        title="Access"
        description="Ways to join this workspace without an invitation."
      />
      <SettingsSection
        id="join-link-heading"
        title="Join link"
        description="Anyone who has this link can join as a member. Share it in places you trust."
      >
        <JoinLinkSection />
      </SettingsSection>
      <SettingsSection
        id="domains-heading"
        title="Allowed domains"
        description="People with a verified email on one of these domains see this workspace when they sign up, and can join it."
      >
        <AllowedDomainsForm />
      </SettingsSection>
    </>
  );
}
