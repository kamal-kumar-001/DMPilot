import { Loader2 } from 'lucide-react';
export default function CreatorLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] flex items-center justify-center gap-2 text-sm text-slate-500"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      Loading content...
    </div>
  );
}
