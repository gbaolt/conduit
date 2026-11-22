import { describe, expect, it } from 'vitest';

import {
  languageForName,
  PLAIN_TEXT,
  type SnippetLanguage,
  snippetName,
} from './snippet-name';

const typescript: SnippetLanguage = {
  id: 'typescript',
  name: 'TypeScript',
  aliases: ['ts', 'cts', 'mts'],
};
const python: SnippetLanguage = {
  id: 'python',
  name: 'Python',
  aliases: ['py'],
};
const cpp: SnippetLanguage = { id: 'cpp', name: 'C++', aliases: ['c++'] };
const languages = [typescript, python, cpp];

describe('snippetName', () => {
  it('names a snippet without a title after its language', () => {
    expect(snippetName('', typescript)).toBe('snippet.ts');
    expect(snippetName('  ', PLAIN_TEXT)).toBe('snippet.txt');
    expect(snippetName('', cpp)).toBe('snippet.cpp');
  });

  it("adds the language's extension to a title without one", () => {
    expect(snippetName('deploy notes', PLAIN_TEXT)).toBe('deploy notes.txt');
    expect(snippetName('server', python)).toBe('server.py');
  });

  it('keeps a title whose extension matches the language', () => {
    expect(snippetName('app.ts', typescript)).toBe('app.ts');
    expect(snippetName('worker.mts', typescript)).toBe('worker.mts');
    expect(snippetName('readme.TXT', PLAIN_TEXT)).toBe('readme.TXT');
  });

  it("keeps a mismatched extension and adds the language's after it", () => {
    expect(snippetName('invoice.pdf', PLAIN_TEXT)).toBe('invoice.pdf.txt');
    expect(snippetName('main.py', typescript)).toBe('main.py.ts');
  });

  it('never puts a folder in the name', () => {
    expect(snippetName('../etc/passwd', PLAIN_TEXT)).toBe('..-etc-passwd.txt');
  });
});

describe('languageForName, for Auto detect', () => {
  it("reads the title's extension", () => {
    expect(languageForName('app.ts', languages)).toBe(typescript);
    expect(languageForName('job.PY', languages)).toBe(python);
  });

  it('falls back to plain text', () => {
    expect(languageForName('', languages)).toBe(PLAIN_TEXT);
    expect(languageForName('notes', languages)).toBe(PLAIN_TEXT);
    expect(languageForName('notes.txt', languages)).toBe(PLAIN_TEXT);
    expect(languageForName('archive.zip', languages)).toBe(PLAIN_TEXT);
    expect(languageForName('.env', languages)).toBe(PLAIN_TEXT);
  });

  it('names a file that Auto detect read as its language', () => {
    expect(snippetName('app.ts', languageForName('app.ts', languages))).toBe(
      'app.ts'
    );
    expect(
      snippetName('invoice.pdf', languageForName('invoice.pdf', languages))
    ).toBe('invoice.pdf.txt');
  });
});
