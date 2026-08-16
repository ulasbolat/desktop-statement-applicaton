"use client";

import { useState } from "react";

export type Kart = { id: string; front: string; back: string };

export function FlashcardDeck({ kartlar }: { kartlar: Kart[] }) {
  const [indeks, setIndeks] = useState(0);
  const [acik, setAcik] = useState(false);

  const kart = kartlar[indeks];

  function git(yon: 1 | -1) {
    setAcik(false);
    setIndeks((i) => (i + yon + kartlar.length) % kartlar.length);
  }

  return (
    <div>
      <p className="text-sm text-stone-600">
        Kart {indeks + 1} / {kartlar.length}
      </p>

      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        className="mt-3 flex min-h-56 w-full flex-col items-center justify-center rounded-xl border-2 border-stone-200 bg-white p-8 text-center transition-colors hover:border-stone-300"
      >
        <p className="text-lg font-medium text-balance">{kart.front}</p>

        {acik ? (
          <p className="mt-4 border-t border-stone-200 pt-4 text-stone-700 text-pretty">
            {kart.back}
          </p>
        ) : (
          <p className="mt-4 text-sm text-stone-400">Cevabı görmek için tıkla</p>
        )}
      </button>

      <div className="mt-4 flex justify-between gap-3">
        <button
          type="button"
          onClick={() => git(-1)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
        >
          ← Önceki
        </button>
        <button
          type="button"
          onClick={() => git(1)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
        >
          Sonraki →
        </button>
      </div>
    </div>
  );
}
