/**
 * Runs ten fixed questions, three follow-ups that lean on an earlier turn, two questions about attached files,
 * and three that need a tool, over a fixed corpus through the real model. It fails when an answer cites a source
 * that does not support it, misses the source that does, misses the fact it must state, or answers a question
 * the corpus can't answer. It prints every answer. Run it once per model or prompt change:
 *
 *   OPENROUTER_API_KEY=... AI_SUMMARY_MODEL=deepseek/deepseek-v4.1-flash-1017 pnpm --filter server eval:ask
 *
 * Each source carries one fact. A question lists the sources that hold its answer, or none when the corpus
 * doesn't answer it. A follow-up also prints the standalone query the rewrite call writes for it, though the
 * corpus here is not searched. The tools answer from a fixed channel and a fixed saved message, as the real
 * ones would, and find nothing else. It spends about thirty model requests.
 */
import '@/load-env';
import 'reflect-metadata';

import { readFileSync } from 'node:fs';

import {
  type ListedFile,
  type MessageHit,
  ModelAnswerSchema,
} from '@conduit/contract';
import { z } from 'zod';

import type { ModelImage, ModelTools } from '@/ai/domain/model.port';
import { AiSdkModel, selectModel } from '@/ai/infrastructure/ai-sdk-model';
import {
  ASK_MAX_OUTPUT_TOKENS,
  ASK_REWRITE_MAX_OUTPUT_TOKENS,
  ASK_REWRITE_PROMPT,
  ASK_SYSTEM_PROMPT,
  ASK_TOOL_STEPS_MAX,
  type AskAttachmentInput,
  type AskHistory,
  type AskInput,
  type AskPassage,
  buildAskInput,
  citeAnswer,
  passageKey,
  sourceTag,
  standaloneQueryPrompt,
  StandaloneQuerySchema,
} from '@/ask/domain/ask-prompt';
import type { Passage } from '@/search/domain/search.repository';

const PEOPLE = ['Linh Tran', 'Bao Le', 'Mai Pham'];
const ROOMS = ['pricing', 'ops', 'hiring'];

const at = (n: number) => new Date(Date.UTC(2026, 10, 3, 9, n));

const message = (id: string, n: number, body: string): Passage => ({
  type: 'message',
  message: {
    id,
    parentId: null,
    body,
    room: { id: ROOMS[n % 3]!, name: ROOMS[n % 3]!, kind: 'channel' },
    author: { id: `u${n % 3}`, name: PEOPLE[n % 3]!, image: null },
    createdAt: at(n),
    updatedAt: at(n),
  } as MessageHit,
});

const chunk = (id: string, name: string, n: number, text: string): Passage => ({
  type: 'file',
  file: {
    id,
    name,
    room: { id: ROOMS[n % 3]!, name: ROOMS[n % 3]!, kind: 'channel' },
    uploader: { id: `u${n % 3}`, name: PEOPLE[n % 3]!, image: null },
    createdAt: at(n),
  } as ListedFile,
  text,
});

const CORPUS: Passage[] = [
  message('m1', 0, 'The Starter plan stays at 10 dollars a month next year.'),
  message(
    'm2',
    1,
    'The on-call rotation moves to Tuesdays starting in December.'
  ),
  message('m3', 2, 'We are hiring two backend engineers this quarter.'),
  message('m4', 3, 'ok, sounds good'),
  message('m5', 4, 'The database failover drill is on the 14th at 3 pm.'),
  message(
    'm6',
    5,
    'Offers for the backend roles go out once the hiring panel signs off.'
  ),
  chunk(
    'f1',
    'Q3 pricing.pdf',
    6,
    'Q3 pricing. The Team plan costs 40 dollars per seat. Annual billing gets a 15 percent discount.'
  ),
  chunk(
    'f2',
    'Runbook.pdf',
    7,
    'Runbook. Restart the queue worker with the restart-worker script before paging anyone.'
  ),
  chunk(
    'f3',
    'Interview guide.pdf',
    8,
    'Interview guide. Every candidate gets a system design round and a pairing round.'
  ),
  message('m7', 9, '+1'),
];

/** What the tools find. Nothing else is there, so a question about a DM finds nothing. */
const LAUNCH: AskPassage = {
  type: 'channel',
  channel: {
    id: 'c1',
    name: 'launch',
    topic: 'Shipping the November release',
    description: null,
    visibility: 'public',
    archived: false,
    memberCount: 3,
    members: [
      { name: 'Mai Pham', manager: true },
      { name: 'Linh Tran', manager: false },
      { name: 'Bao Le', manager: false },
    ],
  },
};
const SAVED: AskPassage = message(
  's1',
  1,
  'The team offsite is in Da Lat on the 12th, and the bus leaves at 7 am.'
);

/** Read-only tools over the fixed finds, numbering each as the service does. */
function tools(input: AskInput): ModelTools {
  const add = (found: AskPassage[]) => {
    const tags = found.map((passage) => {
      const key = passageKey(passage);
      const known = input.sources.findIndex((s) => passageKey(s) === key);
      if (known === -1) input.sources.push(passage);
      return sourceTag(
        known === -1 ? input.sources.length : known + 1,
        passage,
        new Map()
      )!;
    });
    return Promise.resolve(
      tags.length > 0 ? tags.join('\n') : 'Nothing found.'
    );
  };
  const none = (description: string): ModelTools[string] => ({
    description,
    input: z.object({ query: z.string().optional() }),
    execute: () => add([]),
  });
  return {
    search: none(
      'Search the messages and files in channels the asker can read, with other words than the question.'
    ),
    thread: none(
      'Read the whole thread that a message source is in: its first message and the replies.'
    ),
    channel: {
      description:
        'Look up channels by name: topic, description, and who is in each, managers marked.',
      input: z.object({ name: z.string() }),
      execute: ({ name }: { name: string }) =>
        add(
          'launch'.includes(name.replace(/^#/, '').toLowerCase())
            ? [LAUNCH]
            : []
        ),
    },
    people: none(
      'Find workspace members by name, with their role in the workspace.'
    ),
    saved: {
      description:
        "The asker's own saved messages, newest saved first, optionally only those holding a word of query.",
      input: z.object({ query: z.string().optional() }),
      execute: () => add([SAVED]),
    },
    drafts: none(
      "The asker's own unsent drafts, newest first, optionally only those holding a word of query."
    ),
  };
}

const INVOICE: ModelImage = {
  mediaType: 'image/png',
  data: readFileSync(new URL('./fixtures/ask-invoice.png', import.meta.url)),
};

type Question = {
  text: string;
  supported: string[];
  history?: AskHistory;
  attachments?: AskAttachmentInput[];
  images?: ModelImage[];
  /** What the answer must say, for an answer from an attachment, which cites no number. */
  says?: RegExp;
};

const earlier = (question: string, body: string): AskHistory => [
  { question, found: true, body },
];

const QUESTIONS: Question[] = [
  { text: 'How much does the Starter plan cost?', supported: ['message:m1'] },
  { text: 'What does the Team plan cost per seat?', supported: ['file:f1'] },
  { text: 'Is there a discount for paying yearly?', supported: ['file:f1'] },
  { text: 'When does the on-call rotation change?', supported: ['message:m2'] },
  { text: 'When is the failover drill?', supported: ['message:m5'] },
  {
    text: 'What should I do before paging someone about the queue worker?',
    supported: ['file:f2'],
  },
  {
    text: 'How many backend engineers are we hiring?',
    supported: ['message:m3'],
  },
  { text: 'What rounds does a candidate go through?', supported: ['file:f3'] },
  { text: 'Who is the new head of marketing?', supported: [] },
  { text: 'What is the office wifi password?', supported: [] },
  {
    text: 'And the Team plan, per seat?',
    supported: ['file:f1'],
    history: earlier(
      'How much does the Starter plan cost?',
      'The Starter plan stays at 10 dollars a month next year.'
    ),
  },
  {
    text: 'When do their offers go out?',
    supported: ['message:m6'],
    history: earlier(
      'How many backend engineers are we hiring?',
      'We are hiring two backend engineers this quarter.'
    ),
  },
  {
    text: 'And the Enterprise plan?',
    supported: [],
    history: earlier(
      'What does the Team plan cost per seat?',
      'The Team plan costs 40 dollars per seat.'
    ),
  },
  {
    text: 'What is the total on this invoice?',
    supported: [],
    attachments: [{ type: 'image', name: 'invoice.png' }],
    images: [INVOICE],
    says: /4,?812/,
  },
  {
    text: 'Which day does the launch move to, by my notes?',
    supported: [],
    attachments: [
      {
        type: 'document',
        name: 'notes.md',
        text: 'Planning notes. The launch moves from Monday to Thursday the 20th.',
      },
    ],
    says: /Thursday/,
  },
  { text: 'Who manages #launch?', supported: ['channel:c1'], says: /Mai Pham/ },
  {
    text: 'What did I save about the offsite?',
    supported: ['message:s1'],
    says: /Da Lat/,
  },
  {
    text: 'What did Bao tell me in our direct messages about payroll?',
    supported: [],
  },
];

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

for (const question of QUESTIONS) {
  let query: string | undefined;
  if (question.history) {
    for await (const partial of model.streamObject({
      system: ASK_REWRITE_PROMPT,
      prompt: standaloneQueryPrompt(question.history, question.text),
      schema: StandaloneQuerySchema,
      maxOutputTokens: ASK_REWRITE_MAX_OUTPUT_TOKENS,
    })) {
      query = partial.query;
    }
  }
  const input = buildAskInput(
    question.text,
    CORPUS,
    new Map(),
    question.history,
    question.attachments
  );
  let last;
  for await (const partial of model.streamObject({
    system: ASK_SYSTEM_PROMPT,
    prompt: input.prompt,
    images: question.images,
    schema: ModelAnswerSchema,
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    tools: tools(input),
    maxToolSteps: ASK_TOOL_STEPS_MAX,
  })) {
    last = partial;
  }
  const answer = ModelAnswerSchema.parse(last);
  const { body, cited } = citeAnswer(
    answer.found ? answer.body : '',
    input.sources.map(passageKey)
  );

  const problems: string[] = [];
  if (question.supported.length === 0 && !question.says) {
    if (answer.found)
      problems.push('answered a question the corpus does not answer');
  } else {
    if (question.says && !question.says.test(body)) {
      problems.push(`does not say ${question.says}`);
    }
    if (!answer.found) problems.push('said it could not find the answer');
    for (const key of cited) {
      if (!question.supported.includes(key))
        problems.push(`cites ${key}, which does not support it`);
    }
    for (const key of question.supported) {
      if (!cited.includes(key)) problems.push(`misses ${key}`);
    }
  }

  failures += problems.length > 0 ? 1 : 0;
  console.log(`\n${problems.length ? 'FAIL' : 'PASS'} ${question.text}`);
  if (query !== undefined) console.log(`  query: ${query}`);
  console.log(`  ${answer.found ? body : '(cannot answer)'}`);
  console.log(`  cites: ${cited.join(', ') || 'nothing'}`);
  for (const problem of problems) console.log(`  - ${problem}`);
}

console.log(
  `\n${QUESTIONS.length - failures} of ${QUESTIONS.length} questions passed.`
);
process.exit(failures > 0 ? 1 : 0);
