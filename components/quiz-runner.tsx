"use client";

import Link from "next/link";
import { useState } from "react";

export type QuizSorusu = {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type Props = {
  deckId: string;
  sorular: QuizSorusu[];
  /** Paylaşım linkinden gelen anonim kullanıcı için sonuç kaydedilmez. */
  kayitYap: boolean;
  /** Bittiğinde dönülecek yer. */
  bitisLinki: string;
};

const SIK_HARFLERI = ["A", "B", "C", "D"];

export function QuizRunner({ deckId, sorular, kayitYap, bitisLinki }: Props) {
  const [indeks, setIndeks] = useState(0);
  const [secim, setSecim] = useState<number | null>(null);
  const [dogrular, setDogrular] = useState(0);
  const [yanlisIdler, setYanlisIdler] = useState<string[]>([]);
  const [bitti, setBitti] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const soru = sorular[indeks];
  const sonSoru = indeks === sorular.length - 1;
  const cevaplandi = secim !== null;

  function cevapla(sik: number) {
    if (cevaplandi) return;
    setSecim(sik);

    if (sik === soru.correct_index) {
      setDogrular((d) => d + 1);
    } else {
      setYanlisIdler((y) => [...y, soru.id]);
    }
  }

  async function ilerle() {
    if (!sonSoru) {
      setIndeks((i) => i + 1);
      setSecim(null);
      return;
    }

    setBitti(true);

    if (!kayitYap) return;

    setKaydediliyor(true);
    try {
      await fetch("/api/quiz/sonuc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deckId,
          dogruSayisi: dogrular,
          toplamSoru: sorular.length,
          yanlisSoruIdleri: yanlisIdler,
        }),
      });
    } catch {
      // Sonuç kaydı kritik değil; kullanıcıyı hata ekranıyla karşılamayalım.
    } finally {
      setKaydediliyor(false);
    }
  }

  if (bitti) {
    const yuzde = Math.round((dogrular / sorular.length) * 100);

    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-sm text-stone-600">Quiz bitti</p>
        <p className="mt-2 text-4xl font-bold">
          {dogrular}/{sorular.length}
        </p>
        <p className="mt-1 text-stone-600">%{yuzde} doğru</p>

        {kayitYap && yanlisIdler.length > 0 ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Yanlış yaptığın {yanlisIdler.length} soru tekrar kuyruğuna eklendi.
            Yarın karşına tekrar çıkacaklar.
          </p>
        ) : null}

        {!kayitYap ? (
          <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700">
            Sonucun kaydedilmedi. Kendi destelerini oluşturmak ve tekrar
            kuyruğunu takip etmek için{" "}
            <Link href="/giris" className="font-medium underline">
              giriş yap
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIndeks(0);
              setSecim(null);
              setDogrular(0);
              setYanlisIdler([]);
              setBitti(false);
            }}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
          >
            Baştan çöz
          </button>
          <Link
            href={bitisLinki}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
          >
            {kaydediliyor ? "Kaydediliyor…" : "Desteye dön"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>
          Soru {indeks + 1} / {sorular.length}
        </span>
        <span>{dogrular} doğru</span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuenow={indeks + 1}
        aria-valuemin={1}
        aria-valuemax={sorular.length}
        aria-label="Quiz ilerlemesi"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width]"
          style={{ width: `${((indeks + 1) / sorular.length) * 100}%` }}
        />
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-medium text-balance">{soru.stem}</h2>

        <ul className="mt-5 space-y-2">
          {soru.options.map((sik, i) => {
            const dogruSik = i === soru.correct_index;
            const secilen = i === secim;

            let sinif = "border-stone-300 hover:border-stone-400 hover:bg-stone-50";
            if (cevaplandi && dogruSik) {
              sinif = "border-emerald-600 bg-emerald-50";
            } else if (cevaplandi && secilen) {
              sinif = "border-red-500 bg-red-50";
            } else if (cevaplandi) {
              sinif = "border-stone-200 opacity-60";
            }

            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => cevapla(i)}
                  disabled={cevaplandi}
                  aria-pressed={secilen}
                  className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${sinif}`}
                >
                  <span className="mt-0.5 font-semibold text-stone-500">
                    {SIK_HARFLERI[i]}
                  </span>
                  <span className="flex-1">{sik}</span>
                  {cevaplandi && dogruSik ? (
                    <span aria-hidden className="text-emerald-700">
                      ✓
                    </span>
                  ) : null}
                  {cevaplandi && secilen && !dogruSik ? (
                    <span aria-hidden className="text-red-600">
                      ✕
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {cevaplandi ? (
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
        ) : null}

        <button
          type="button"
          onClick={ilerle}
          disabled={!cevaplandi}
          className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {sonSoru ? "Bitir" : "Sonraki soru"}
        </button>
      </div>
    </div>
  );
}
