import { Button } from '@/components/ui/button';

export function SignIn({
  onSignIn,
  error,
}: {
  onSignIn: () => void;
  error?: string;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-chrome px-6 text-chrome-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/favicon.svg" alt="" className="size-14" />
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          skkil time
        </h1>
        <p className="max-w-sm text-balance text-chrome-muted">
          Plan your week, block your time and see where it went.
        </p>
      </div>
      <Button size="lg" variant="secondary" onClick={onSignIn}>
        Sign in
      </Button>
      {error && (
        <p role="alert" className="text-sm text-chrome-muted">
          {error}
        </p>
      )}
    </main>
  );
}
