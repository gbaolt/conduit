'use client';

import { Button } from '@conduit/ui/components/button';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={
        mounted && isDark ? 'Switch to light mode' : 'Switch to dark mode'
      }
      onClick={() => {
        setTheme(isDark ? 'light' : 'dark');
      }}
    >
      {mounted && isDark ? <IconSun /> : <IconMoon />}
    </Button>
  );
}
