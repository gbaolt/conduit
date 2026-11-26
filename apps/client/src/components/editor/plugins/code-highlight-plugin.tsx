import { $createCodeHighlightNode } from '@lexical/code';
import {
  registerCodeHighlighting,
  ShikiTokenizer,
  type Tokenizer,
} from '@lexical/code-shiki';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createLineBreakNode,
  $createTabNode,
  $getEditor,
  $getNodeByKey,
  HISTORY_MERGE_TAG,
  type LexicalNode,
  tokenizeRawText,
} from 'lexical';
import { useEffect } from 'react';
import { createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { bundledLanguagesInfo } from 'shiki/langs';

// The themes `CodeBlockContent` uses, so a block reads the same in the composer and in the log.
const THEMES = { light: 'github-light', dark: 'github-dark' } as const;

type Shiki = {
  highlighter: ReturnType<typeof createHighlighterCoreSync>;
  themesLoaded: Promise<unknown>;
};

let shiki: Shiki | null = null;
let themesReady = false;

// Built on first use, so a page that never shows a code block never starts Shiki.
function getShiki() {
  if (shiki) return shiki;
  // Lexical's own Shiki tokenizer colours with one theme, so this one asks for both as CSS variables.
  const highlighter = createHighlighterCoreSync({
    engine: createJavaScriptRegexEngine(),
    themes: [],
    langs: [],
  });
  const themesLoaded = Promise.all(
    [
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ].map((theme) =>
      theme.then((module) => highlighter.loadTheme(module.default))
    )
  ).then(
    () => {
      themesReady = true;
    },
    (error) => {
      shiki = null;
      themesReady = false;
      throw error;
    }
  );
  // Prevent unhandled rejections on language-free blocks that never await `themesLoaded`.
  void themesLoaded.catch(() => undefined);
  shiki = { highlighter, themesLoaded };
  return shiki;
}

const languagesLoading = new Map<string, Promise<unknown>>();

function languageInfo(language: string) {
  return bundledLanguagesInfo.find(
    (info) => info.id === language || info.aliases?.includes(language)
  );
}

function isReady(language: string) {
  return (
    themesReady &&
    getShiki().highlighter.getLoadedLanguages().includes(language)
  );
}

function load(language: string, info: { import: () => Promise<unknown> }) {
  let loading = languagesLoading.get(language);
  if (!loading) {
    const { highlighter, themesLoaded } = getShiki();
    loading = Promise.all([
      themesLoaded,
      highlighter.loadLanguage(info.import() as never),
    ]).catch((error) => {
      languagesLoading.delete(language);
      throw error;
    });
    languagesLoading.set(language, loading);
  }
  return loading;
}

type Token = { content: string; htmlStyle?: Record<string, string> };

function $nodesOf(lines: Token[][]) {
  const nodes: LexicalNode[] = [];
  lines.forEach((line, index) => {
    if (index) nodes.push($createLineBreakNode());
    for (const token of line) {
      const style = Object.entries(token.htmlStyle ?? {})
        .map(([property, value]) => `${property}:${value}`)
        .join(';');
      tokenizeRawText(token.content, {
        linebreak: () => nodes.push($createLineBreakNode()),
        tab: () => nodes.push($createTabNode()),
        text: (part) =>
          nodes.push($createCodeHighlightNode(part).setStyle(style)),
      });
    }
  });
  return nodes;
}

const tokenizer: Tokenizer = {
  ...ShikiTokenizer,
  // A fence without a language keeps none, so it sends as typed and shows no language header.
  defaultLanguage: null,
  defaultTheme: THEMES.light,
  $tokenize(codeNode, language) {
    const code = codeNode.getTextContent();
    const info = language ? languageInfo(language) : undefined;

    if (language && info && isReady(language)) {
      const { tokens } = getShiki().highlighter.codeToTokens(code, {
        lang: language,
        themes: THEMES,
        defaultColor: false,
      });
      return $nodesOf(tokens);
    }

    if (language && info) {
      const editor = $getEditor();
      const key = codeNode.getKey();
      load(language, info).then(
        () =>
          editor.update(() => $getNodeByKey(key)?.markDirty(), {
            tag: HISTORY_MERGE_TAG,
          }),
        () => undefined
      );
    }
    return $nodesOf(code.split('\n').map((line) => [{ content: line }]));
  },
};

export function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    getShiki();
    return registerCodeHighlighting(editor, tokenizer);
  }, [editor]);

  return null;
}
