/** A NUL byte this early means the file is binary, whatever its content type says. */
const BINARY_SNIFF_BYTES = 8 * 1024;

/** How many bytes a UTF-8 sequence that starts with `byte` holds, or 0 for a continuation byte. */
function sequenceLength(byte: number) {
  if (byte < 0x80) return 1;
  if (byte >= 0xf0) return 4;
  if (byte >= 0xe0) return 3;
  if (byte >= 0xc0) return 2;
  return 0;
}

/** Drops a character the end of `bytes` cut in half, so a cut never shows a replacement mark. */
function wholeCharacters(bytes: Uint8Array) {
  for (let back = 1; back <= Math.min(4, bytes.length); back += 1) {
    const length = sequenceLength(bytes[bytes.length - back]!);
    if (length === 0) continue;
    return length > back ? bytes.subarray(0, bytes.length - back) : bytes;
  }
  return bytes;
}

/**
 * The start of a text file as UTF-8, or null when it is binary. `cut` says the bytes stop before the file does,
 * so a character split at the end is dropped.
 */
export function readableText(bytes: Uint8Array, cut: boolean) {
  if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return null;
  return new TextDecoder('utf-8').decode(cut ? wholeCharacters(bytes) : bytes);
}
