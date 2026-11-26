/** A starting document for an empty canvas. Picking one also names the canvas and sets its icon, if still unset. */
export type CanvasTemplate = {
  id: string;
  label: string;
  /** One emoji, shown on the picker and given to the canvas. */
  icon: string;
  markdown: string;
};

export const CANVAS_TEMPLATES: readonly CanvasTemplate[] = [
  {
    id: 'project-brief',
    label: 'Project brief',
    icon: '📋',
    markdown: `## Overview

What are we building, and why now?

## Goals

- The outcome this project must reach
- How we will know it worked

## Scope

### In scope

- What this project delivers

### Out of scope

- What it leaves for later

## Timeline

| Milestone | Owner | Date |
| --- | --- | --- |
| Kickoff | | |
| First review | | |
| Launch | | |

## Open questions

- [ ] A question the team still has to answer
`,
  },
  {
    id: 'meeting-notes',
    label: 'Meeting notes',
    icon: '📝',
    markdown: `## Attendees

- Who joined

## Agenda

1. The first topic

## Notes

- What was said

## Decisions

- What the group agreed

## Action items

- [ ] Who does what, and by when
`,
  },
  {
    id: 'retrospective',
    label: 'Retrospective',
    icon: '🔁',
    markdown: `## What went well

- Something worth keeping

## What could be better

- Something that slowed us down

## Ideas to try

- One change for next time

## Action items

- [ ] Who does what, and by when
`,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: '👋',
    markdown: `## Welcome

A few lines about the team and what it works on.

## Your first week

- [ ] Set up your accounts
- [ ] Meet your onboarding buddy
- [ ] Ship a first small change

## People to meet

| Name | Role | Ask them about |
| --- | --- | --- |
| | | |

## Useful links

- A doc or channel worth bookmarking
`,
  },
];
