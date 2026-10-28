import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  // Match the server on the first render; the effect below reads the real value.
  const [value, setValue] = useState(true);

  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener('change', onChange);
    setValue(result.matches);

    return () => result.removeEventListener('change', onChange);
  }, [query]);

  return value;
}
