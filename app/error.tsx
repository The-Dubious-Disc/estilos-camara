"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-foreground">Esta página no pudo abrirse</h1>
      <p className="text-muted-foreground">
        Puedes intentarlo otra vez. Tus fotos siguen solo en este dispositivo.
      </p>
      <Button type="button" className="h-11 w-fit px-4" onClick={() => retry()}>
        Reintentar
      </Button>
    </main>
  );
}
