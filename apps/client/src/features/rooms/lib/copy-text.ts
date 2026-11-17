import { toast } from 'sonner';

/** Copies `text` and says so, for a menu row that closes before a button could show the result. */
export function copyText(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied'),
    () => toast.error('Could not copy')
  );
}
