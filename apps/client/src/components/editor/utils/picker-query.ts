/** Whether a picker option matches what was typed after its trigger. The query is literal text, never a pattern. */
export function matchesPickerQuery(
  option: { title: string; keywords: string[] },
  queryString: string
) {
  const regex = new RegExp(
    queryString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i'
  );
  return (
    regex.test(option.title) ||
    option.keywords.some((keyword) => regex.test(keyword))
  );
}
