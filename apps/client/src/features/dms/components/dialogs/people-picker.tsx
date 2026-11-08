'use client';

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@conduit/ui/components/combobox';

export type Person = { id: string; name: string };

/** Chips and a search box over `people`. */
export function PeoplePicker({
  people,
  selected,
  onChange,
  emptyText,
}: {
  people: Person[];
  selected: Person[];
  onChange: (selected: Person[]) => void;
  emptyText: string;
}) {
  const anchor = useComboboxAnchor();

  return (
    <Combobox
      multiple
      autoHighlight
      items={people}
      value={selected}
      onValueChange={onChange}
      itemToStringLabel={(person: Person) => person.name}
      isItemEqualToValue={(a: Person, b: Person) => a.id === b.id}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(values: Person[]) => (
            <>
              {values.map((person) => (
                <ComboboxChip key={person.id}>{person.name}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                autoFocus
                aria-label="Search people"
                placeholder={selected.length ? '' : 'Search people'}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(person: Person) => (
            <ComboboxItem key={person.id} value={person}>
              {person.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
