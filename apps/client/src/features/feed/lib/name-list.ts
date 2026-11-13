const list = new Intl.ListFormat('en', { type: 'conjunction' });

/** "Linh and Bao", "Linh, Bao, and Mai", and past three, "Linh, Bao, and 2 others". */
export function nameList(names: readonly string[]) {
  return list.format(
    names.length > 3
      ? [...names.slice(0, 2), `${names.length - 2} others`]
      : names
  );
}
