"use client";

import { useState } from "react";

type Props = {
  deckId: string;
  baslangicAcik: boolean;
  baslangicSlug: string | null;
  hazirMi: boolean;
};

export function ShareToggle({
  deckId,
  baslangicAcik,
  baslangicSlug,
  hazirMi,
}: Props) {
  const [acik, setAcik] = useState(baslangicAcik);
  const [slug, setSlug] = useState(baslangicSlug);
  const [calisiyor, setCalisiyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Link'i sunucuda değil tarayıcıda kuruyoruz: üretimde ve yerelde
  // doğru alan adı kendiliğinden gelsin.
  const link = slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${slug}`
    : "";

  async function degistir(yeniDurum: boolean) {
    setCalisiyor(true);
    setHata(null);
    try {
      const cevap = await fetch(`/api/decks/${deckId}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acik: yeniDurum }),
      });

      const sonuc = (await cevap.json()) as
        | { acik: boolean; slug: string }
        | { hata: string };

      if (!cevap.ok) {
        setHata("hata" in sonuc ? sonuc.hata : "Paylaşım güncellenemedi.");
        return;
      }

      if ("slug" in sonuc) {
        setAcik(sonuc.acik);
        setSlug(sonuc.slug);
      }
    } catch {
      setHata("Bağlantı hatası. Tekrar dene.");
    } finally {
      setCalisiyor(false);
    }
  }

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(link);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      setHata("Kopyalanamadı, linki elle seçebilirsin.");
    }
  }

  if (!hazirMi) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">Arkadaşlarınla paylaş</p>
          <p className="mt-1 text-sm text-stone-600">
            Link ile herkes giriş yapmadan bu quizi çözebilir.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={acik}
          aria-label="Paylaşımı aç/kapat"
          disabled={calisiyor}
          onClick={() => void degistir(!acik)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            acik ? "bg-emerald-600" : "bg-stone-300"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] ${
              acik ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {acik && slug ? (
        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={link}
            aria-label="Paylaşım linki"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void kopyala()}
            className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
          >
            {kopyalandi ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
      ) : null}

      {hata ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {hata}
        </p>
      ) : null}
    </div>
  );
}
