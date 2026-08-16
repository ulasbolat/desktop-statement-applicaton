"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { LIMITS } from "@/lib/env";
import { sha256Hex } from "@/lib/hash";
import { createClient } from "@/lib/supabase/client";

type Durum =
  | { ad: "bos" }
  | { ad: "calisiyor"; mesaj: string }
  | { ad: "hata"; mesaj: string };

export function UploadDropzone({ kalanHak }: { kalanHak: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [durum, setDurum] = useState<Durum>({ ad: "bos" });
  const [suruklenıyor, setSurukleniyor] = useState(false);

  const kilitli = durum.ad === "calisiyor" || kalanHak <= 0;

  async function dosyayiIsle(file: File) {
    setDurum({ ad: "hata", mesaj: "" });

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setDurum({ ad: "hata", mesaj: "Sadece PDF yükleyebilirsin." });
      return;
    }

    if (file.size > LIMITS.maxFileBytes) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setDurum({
        ad: "hata",
        mesaj: `Dosya ${mb} MB. En fazla ${LIMITS.maxFileBytes / 1024 / 1024} MB yükleyebilirsin.`,
      });
      return;
    }

    try {
      setDurum({ ad: "calisiyor", mesaj: "Dosya kontrol ediliyor…" });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setDurum({ ad: "hata", mesaj: "Oturumun kapanmış. Tekrar giriş yap." });
        return;
      }

      // Hash'i tarayıcıda hesaplıyoruz ki dosya adı ne olursa olsun aynı
      // içerik aynı yola gitsin — böylece aynı PDF depoda tekrarlanmıyor.
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = await sha256Hex(bytes);
      const yol = `${user.id}/${hash}.pdf`;

      setDurum({ ad: "calisiyor", mesaj: "Yükleniyor…" });
      const { error: yuklemeHatasi } = await supabase.storage
        .from("pdfs")
        .upload(yol, file, { contentType: "application/pdf", upsert: true });

      if (yuklemeHatasi) {
        setDurum({
          ad: "hata",
          mesaj: "Dosya yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.",
        });
        return;
      }

      setDurum({ ad: "calisiyor", mesaj: "İçerik okunuyor…" });
      const cevap = await fetch("/api/decks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storagePath: yol,
          fileHash: hash,
          fileName: file.name,
        }),
      });

      const sonuc = (await cevap.json()) as
        | { deckId: string }
        | { hata: string };

      if (!cevap.ok) {
        setDurum({
          ad: "hata",
          mesaj: "hata" in sonuc ? sonuc.hata : "Beklenmeyen bir hata oldu.",
        });
        return;
      }

      if ("deckId" in sonuc) {
        router.push(`/deste/${sonuc.deckId}`);
        router.refresh();
      }
    } catch {
      setDurum({
        ad: "hata",
        mesaj: "Beklenmeyen bir hata oldu. Tekrar dene.",
      });
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!kilitli) setSurukleniyor(true);
        }}
        onDragLeave={() => setSurukleniyor(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurukleniyor(false);
          if (kilitli) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void dosyayiIsle(file);
        }}
        className={[
          "rounded-xl border-2 border-dashed p-10 text-center transition-colors",
          suruklenıyor
            ? "border-emerald-500 bg-emerald-50"
            : "border-stone-300 bg-white",
          kilitli ? "opacity-60" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={kilitli}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void dosyayiIsle(file);
            e.target.value = ""; // aynı dosya tekrar seçilebilsin
          }}
        />

        {durum.ad === "calisiyor" ? (
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-stone-700">
            <Spinner />
            {durum.mesaj}
          </p>
        ) : (
          <>
            <p className="font-medium">Ders PDF'ini buraya sürükle</p>
            <p className="mt-1 text-sm text-stone-600">
              En fazla {LIMITS.maxPageCount} sayfa, {LIMITS.maxFileBytes / 1024 / 1024} MB
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={kilitli}
              className="mt-4 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              Dosya seç
            </button>
          </>
        )}
      </div>

      {durum.ad === "hata" && durum.mesaj ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {durum.mesaj}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-stone-500">
        {kalanHak > 0
          ? `Bugün ${kalanHak} yükleme hakkın kaldı.`
          : "Bugünkü yükleme hakkın doldu. Yarın devam edebilirsin."}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}
