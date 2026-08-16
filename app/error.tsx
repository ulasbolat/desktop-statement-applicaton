"use client";

import { useEffect } from "react";

export default function HataSayfasi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Bir şeyler ters gitti</h1>
        <p className="mt-2 text-stone-600">
          Beklenmeyen bir hata oldu. Tekrar denemek çoğu zaman yeterli oluyor.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Tekrar dene
        </button>

        {error.digest ? (
          <p className="mt-4 text-xs text-stone-400">Hata kodu: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
