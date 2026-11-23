/** The text inside a stored file, for search. Empty for a kind it cannot read. */
export abstract class FileText {
  abstract extract(file: {
    key: string;
    contentType: string;
    size: number;
  }): Promise<string>;
}
