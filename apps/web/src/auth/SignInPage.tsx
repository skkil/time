import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ZenBackdrop } from '@/features/zen/ZenBackdrop';

export function SignInPage({
  onSignIn,
  error,
}: {
  onSignIn: () => void;
  error?: string;
}) {
  const [leaving, setLeaving] = useState(false);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 text-foreground">
      <ZenBackdrop className="fixed" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl bg-black/25 px-8 py-10 text-center shadow-2xl ring-1 ring-white/15 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-16 drop-shadow-lg" />
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            skkil time
          </h1>
          <p className="text-balance text-white/75">
            Plan your week, block your time and see where it went, on every
            device you use.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full"
          disabled={leaving}
          onClick={() => {
            setLeaving(true);
            onSignIn();
          }}
        >
          {leaving && <LoaderCircleIcon className="animate-spin" />}
          {leaving ? 'Opening sign-in…' : 'Sign in'}
        </Button>
        {error && (
          <p role="alert" className="-mt-4 text-sm text-red-200">
            {error}
          </p>
        )}
        <p className="-mt-4 text-xs text-white/55">
          New here? You can create an account on the next screen.
        </p>
      </div>
    </main>
  );
}
