"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-semibold">Critical Error</h1>
        <p className="max-w-md text-muted-foreground">
          A critical error occurred. Please refresh the page.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Refresh
        </button>
      </body>
    </html>
  );
}
