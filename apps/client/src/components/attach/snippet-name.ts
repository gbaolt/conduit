/** A language the snippet dialog offers: Shiki's `bundledLanguagesInfo`, or plain text. */
export type SnippetLanguage = {
  id: string;
  name: string;
  aliases?: readonly string[];
};

export const PLAIN_TEXT: SnippetLanguage = {
  id: 'text',
  name: 'Plain text',
  aliases: ['txt'],
};

const EXTENSION = /^[a-z0-9]+$/;

/** The names a file of this language ends with: its id and aliases that can be an extension. */
const extensionsOf = (language: SnippetLanguage) =>
  [language.id, ...(language.aliases ?? [])].filter((name) =>
    EXTENSION.test(name)
  );

/** The language's extension: its shortest one, so TypeScript is `ts` and Python is `py`. */
export function languageExtension(language: SnippetLanguage) {
  const [shortest] = extensionsOf(language).sort((a, b) => a.length - b.length);
  return shortest ?? 'txt';
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/** Auto detect: the language a file name's extension names, or plain text. */
export function languageForName(
  name: string,
  languages: readonly SnippetLanguage[]
): SnippetLanguage {
  const extension = extensionOf(name.trim());
  if (!extension) return PLAIN_TEXT;
  if (extensionsOf(PLAIN_TEXT).includes(extension)) return PLAIN_TEXT;
  return (
    languages.find((language) => extensionsOf(language).includes(extension)) ??
    PLAIN_TEXT
  );
}

/**
 * The snippet's file name. Its extension always names its language, so a snippet never poses as another kind of
 * file: `invoice.pdf` as plain text becomes `invoice.pdf.txt`.
 */
export function snippetName(title: string, language: SnippetLanguage) {
  const name = title.trim().replace(/[/\\]+/g, '-');
  if (!name) return `snippet.${languageExtension(language)}`;
  if (extensionsOf(language).includes(extensionOf(name))) return name;
  return `${name}.${languageExtension(language)}`;
}
