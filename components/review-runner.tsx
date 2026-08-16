"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type TekrarSorusu = {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  deckTitle: string;
};

const SIK_HARFLERI = ["A", "B", "C", "D"];

export function ReviewRunner({ sorular }: { sorular: TekrarSorusu[] }) {
  const router = useRouter();
  const [indeks, setIndeks] = useState(0);
  const [secim, setSecim] = useState<number | null>(null);
  const [dogrular, setDogrular] = useState(0);
  const [bitti, setBitti] = useState(false);

  const soru = sorular[indeks];
  const cevaplandi = secim !== null;

  async function cevapla(sik: number) {
    if (cevaplandi) return;
    setSecim(sik);

    const dogruMu = sik === soru.correct_index;
    if (dogruMu) setDogrular((d) => d + 1);

    try {
      await fetch("/api/reviews/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: soru.id, dogruMu }),
      });
    } catch {
      // Kayıt tutulamadıysa da çalışmaya devam etsin; bir sonraki
      // tekrarda soru zaten yine karşısına çıkacak.
    }
  }

  function ilerle() {
    if (indeks === sorular.length - 1) {
      setBitti(true);
      router.refresh();
      return;
    }
    setIndeks((i) => i + 1);
    setSecim(null);
  }

  if (bitti) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold">Bugünlük bu kadar 🎉</p>
        <p className="mt-2 text-stone-600">
          {sorular.length} soruda {dogrular} doğru.
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Doğru bildiklerin daha uzun aralıkla, yanlışların yarın tekrar
          karşına çıkacak.
        </p>
        <Link
          href="/panel"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Destelerime dön
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>
          {indeks + 1} / {sorular.length}
        </span>
        <span className="truncate pl-4">{soru.deckTitle}</span>
      </div>

      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-medium text-balance">{soru.stem}</h2>

        <ul className="mt-5 space-y-2">
          {soru.options.map((sik, i) => {
            const dogruSik = i === soru.correct_index;
            const secilen = i === secim;

            let sinif = "border-stone-300 hover:border-stone-400 hover:bg-stone-50";
            if (cevaplandi && dogruSik) sinif = "border-emerald-600 bg-emerald-50";
            else if (cevaplandi && secilen) sinif = "border-red-500 bg-red-50";
            else if (cevaplandi) sinif = "border-stone-200 opacity-60";

            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => void cevapla(i)}
                  disabled={cevaplandi}
                  className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${sinif}`}
                >
                  <span className="mt-0.5 font-semibold text-stone-500">
                    {SIK_HARFLERI[i]}
                  </span>
                  <span className="flex-1">{sik}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {cevaplandi ? (
          <>
            <div
              role="status"
              className={`mt-5 rounded-lg px-4 py-3 text-sm ${
                secim === soru.correct_index
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-red-50 text-red-900"
              }`}
            >
              <p className="font-medium">
                {secim === soru.correct_index ? "Doğru!" : "Yanlış."}
              </p>
              <p className="mt-1">{soru.explanation}</p>
            </div>

            <button
              type="button"
              onClick={ilerle}
              className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-800"
            >
              {indeks === sorular.length - 1 ? "Bitir" : "Sonraki"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
