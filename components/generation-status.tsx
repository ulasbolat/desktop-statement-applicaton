"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DeckStatus } from "@/types/database";

type Cevap = {
  status: DeckStatus;
  progress: number;
  bitti?: boolean;
  errorMessage?: string | null;
  soruSayisi?: number;
  kartSayisi?: number;
};

type Props = {
  deckId: string;
  baslangicDurumu: DeckStatus;
  baslangicIlerleme: number;
  baslangicHata: string | null;
};

/**
 * Üretim adımlarını sırayla tetikler.
 *
 * Adımlar ARDIŞIK: bir istek bitmeden sonraki gönderilmiyor. Böylece iki
 * adım aynı anda çalışıp aynı soruları iki kez üretmiyor (veritabanındaki
 * unique kısıt son savunma hattı, ama ona hiç gelmemek daha iyi).
 */
export function GenerationStatus({
  deckId,
  baslangicDurumu,
  baslangicIlerleme,
  baslangicHata,
}: Props) {
  const router = useRouter();
  const [durum, setDurum] = useState<DeckStatus>(baslangicDurumu);
  const [ilerleme, setIlerleme] = useState(baslangicIlerleme);
  const [hata, setHata] = useState<string | null>(baslangicHata);
  const calisiyorRef = useRef(false);

  const adimCalistir = useCallback(
    async (tekrar = false) => {
      if (calisiyorRef.current) return;
      calisiyorRef.current = true;

      try {
        let devam = true;
        while (devam) {
          const cevap = await fetch(
            `/api/decks/${deckId}/process${tekrar ? "?tekrar=1" : ""}`,
            { method: "POST" },
          );
          tekrar = false;

          if (!cevap.ok) {
            const govde = (await cevap.json().catch(() => null)) as {
              hata?: string;
            } | null;
            setHata(
              govde?.hata ??
                "Üretim sırasında bir hata oldu. Sayfayı yenileyip tekrar dene.",
            );
            setDurum("failed");
            return;
          }

          const sonuc = (await cevap.json()) as Cevap;
          setDurum(sonuc.status);
          setIlerleme(sonuc.progress);
          if (sonuc.errorMessage) setHata(sonuc.errorMessage);

          devam = !sonuc.bitti;

          if (sonuc.status === "ready") {
            // Sunucu bileşenleri yeniden çalışsın, sorular görünsün.
            router.refresh();
            return;
          }
        }
      } catch {
        setHata("Bağlantı koptu. Sayfayı yenileyip tekrar dene.");
        setDurum("failed");
      } finally {
        calisiyorRef.current = false;
      }
    },
    [deckId, router],
  );

  useEffect(() => {
    if (durum === "ready" || durum === "failed") return;
    // setTimeout ile bir tik sonraya bırakıyoruz: effect gövdesinde
    // senkron state güncellemesi zincirleme render'a yol açıyor.
    const zamanlayici = setTimeout(() => void adimCalistir(), 0);
    return () => clearTimeout(zamanlayici);
    // Sadece ilk yüklemede başlat; sonraki adımları döngü kendi sürüyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (durum === "ready") return null;

  if (durum === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-medium text-red-900">Deste hazırlanamadı</p>
        <p className="mt-1 text-sm text-red-800">
          {hata ?? "Beklenmeyen bir hata oldu."}
        </p>
        <button
          type="button"
          onClick={() => {
            setHata(null);
            setDurum("generating");
            setIlerleme(0);
            void adimCalistir(true);
          }}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
        >
          Tekrar dene
        </button>
        <p className="mt-2 text-xs text-red-700">
          Tekrar denemek günlük yükleme hakkından düşmez.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <p className="font-medium">Sorular hazırlanıyor…</p>
      <p className="mt-1 text-sm text-stone-600">
        Bu işlem 1-2 dakika sürebilir. Sayfayı kapatabilirsin, kaldığı yerden
        devam eder.
      </p>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuenow={ilerleme}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Üretim ilerlemesi"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
          style={{ width: `${Math.max(4, ilerleme)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-stone-500">%{ilerleme}</p>
    </div>
  );
}
