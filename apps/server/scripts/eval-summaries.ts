/**
 * Runs three fixed 50-message threads through the real model and fails when a bullet cites a message that
 * does not support it. Run it once per model change:
 *
 *   OPENROUTER_API_KEY=... AI_SUMMARY_MODEL=nvidia/nemotron-3.5-super-vl:free pnpm --filter server eval:summaries
 *
 * Each message in a fixture belongs to one topic and carries that topic's two marker words. A cited message
 * supports a bullet when the bullet uses a marker word of the message's topic. Filler messages ("ok", "+1")
 * have no topic, so citing one always fails. The check is lexical, so it catches a wrong citation but cannot
 * judge a paraphrase that drops every marker word. It spends about three model requests.
 */
import '@/load-env';
import 'reflect-metadata';

import { type Message, ModelSummarySchema } from '@conduit/contract';

import { AiSdkModel, selectModel } from '@/ai/infrastructure/ai-sdk-model';
import { citedBullets } from '@/summaries/domain/summary-citations';
import {
  buildSummaryInput,
  SUMMARY_MAX_OUTPUT_TOKENS,
  SUMMARY_SYSTEM_PROMPT,
} from '@/summaries/domain/summary-prompt';

type Topic = { name: string; markers: [string, string] };
type Fixture = { name: string; topics: Topic[] };

const FIXTURES: Fixture[] = [
  {
    name: 'product launch',
    topics: [
      { name: 'invoices', markers: ['invoice', 'finance'] },
      { name: 'webhooks', markers: ['webhook', 'retries'] },
      { name: 'onboarding', markers: ['onboarding', 'checklist'] },
      { name: 'pricing', markers: ['pricing', 'discount'] },
      { name: 'docs', markers: ['docs', 'changelog'] },
    ],
  },
  {
    name: 'incident review',
    topics: [
      { name: 'database', markers: ['replica', 'failover'] },
      { name: 'alerts', markers: ['pager', 'alert'] },
      { name: 'cache', markers: ['cache', 'eviction'] },
      { name: 'rollback', markers: ['rollback', 'deploy'] },
      { name: 'comms', markers: ['statuspage', 'customers'] },
    ],
  },
  {
    name: 'hiring',
    topics: [
      { name: 'recruiter', markers: ['recruiter', 'pipeline'] },
      { name: 'interview', markers: ['interview', 'scorecard'] },
      { name: 'offer', markers: ['offer', 'salary'] },
      { name: 'referral', markers: ['referral', 'bonus'] },
      { name: 'onsite', markers: ['onsite', 'travel'] },
    ],
  },
];

const TEMPLATES = [
  "Has anyone looked at the {a} yet? I'm worried about the {b}.",
  'I looked at the {a}. The {b} is the part that still needs work.',
  'We should settle the {a} before Friday, otherwise the {b} slips.',
  "Agreed. Let's put the {a} first and revisit the {b} on Monday.",
  'Quick update on the {a}: the {b} is done and waiting for review.',
  'Can someone own the {a}? The {b} keeps coming back to me.',
  "I'll take the {a}. Give me until Wednesday for the {b}.",
  'Decision: we ship the {a} as planned and park the {b} for the next cycle.',
];
const FILLER = ['ok', 'thanks!', '+1', 'sounds good', 'on it', 'will do'];
const PEOPLE = new Map([
  ['u1', 'Linh Tran'],
  ['u2', 'Bao Le'],
  ['u3', 'Mai Pham'],
]);

type Line = { message: Message; topic: Topic | null };

/** 40 topic messages and 10 filler messages in a fixed pseudo-random order. */
function buildThread(fixture: Fixture, seed: number): Line[] {
  let state = seed;
  const next = (limit: number) => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state % limit;
  };

  const lines: { body: string; topic: Topic | null }[] = [
    ...fixture.topics.flatMap((topic) =>
      TEMPLATES.map((template) => ({
        body: template
          .replace('{a}', topic.markers[0])
          .replace('{b}', topic.markers[1]),
        topic,
      }))
    ),
    ...Array.from({ length: 10 }, (_, i) => ({
      body: FILLER[i % FILLER.length]!,
      topic: null,
    })),
  ];
  for (let i = lines.length - 1; i > 0; i--) {
    const j = next(i + 1);
    [lines[i], lines[j]] = [lines[j]!, lines[i]!];
  }

  return lines.map((line, index) => ({
    topic: line.topic,
    message: {
      id: `${fixture.name.replace(/\W/g, '')}-${index}`,
      authorId: [...PEOPLE.keys()][index % PEOPLE.size]!,
      body: line.body,
      mentionedUserIds: [],
      createdAt: new Date(Date.UTC(2026, 10, 3, 9, index)),
    } as unknown as Message,
  }));
}

try {
  selectModel(process.env);
} catch {
  console.error(
    'Set AI_SUMMARY_MODEL and OPENROUTER_API_KEY, or AI_GATEWAY_API_KEY, in apps/server/.env.'
  );
  process.exit(2);
}

const model = new AiSdkModel();
let failures = 0;

for (const [index, fixture] of FIXTURES.entries()) {
  const thread = buildThread(fixture, index + 1);
  const input = buildSummaryInput(
    thread.map((line) => line.message),
    PEOPLE
  );
  const topicOf = new Map(thread.map((line) => [line.message.id, line.topic]));

  let last;
  for await (const partial of model.streamObject({
    system: SUMMARY_SYSTEM_PROMPT,
    prompt: input.prompt,
    schema: ModelSummarySchema,
    maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
  })) {
    last = partial;
  }
  const bullets = citedBullets(last, input.labels);

  const problems: string[] = [];
  if (bullets.length === 0) problems.push('no bullet kept a valid source');
  for (const bullet of bullets) {
    const words = new Set(bullet.text.toLowerCase().match(/[a-z]+/g));
    for (const sourceId of bullet.sourceIds) {
      const topic = topicOf.get(sourceId);
      if (!topic?.markers.some((marker) => words.has(marker))) {
        const body = thread.find((line) => line.message.id === sourceId)
          ?.message.body;
        problems.push(`"${bullet.text}" cites "${body}"`);
      }
    }
  }

  failures += problems.length;
  console.log(
    `${problems.length === 0 ? 'ok  ' : 'FAIL'} ${fixture.name}: ${bullets.length} bullets, ${bullets.reduce((sum, b) => sum + b.sourceIds.length, 0)} citations`
  );
  for (const problem of problems) console.log(`     ${problem}`);
}

if (failures > 0) {
  console.error(`${failures} unsupported citation(s).`);
  process.exit(1);
}
