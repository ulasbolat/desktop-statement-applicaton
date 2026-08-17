"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authHataMesaji, formHatasi } from "@/lib/auth-hatalari";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type Mod = "giris" | "kayit";

export function EpostaFormu({ devam }: { devam: string | null }) {
  const router = useRouter();
  const [mod, setMod] = useState<Mod>("giris");
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  // Açık yönlendirme koruması: sadece kendi sitemizdeki göreli yollar.
  const hedef = devam?.startsWith("/") && !devam.startsWith("//") ? devam : "/panel";

  function moduDegistir(yeni: Mod) {
    setMod(yeni);
    setHata(null);
    setBilgi(null);
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);

    const onKontrol = formHatasi(eposta, sifre);
    if (onKontrol) {
      setHata(onKontrol);
      return;
    }

    setCalisiyor(true);
    const supabase = createClient();

    try {
      if (mod === "giris") {
        const { error } = await supabase.auth.signInWithPassword({
          email: eposta.trim(),
          password: sifre,
        });

        if (error) {
          setHata(authHataMesaji(error));
          return;
        }

        // Oturum cookie'si tarayıcı client'ı tarafından yazıldı; refresh
        // ile sunucu bileşenleri yeni oturumu görsün.
        router.push(hedef);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: eposta.trim(),
          password: sifre,
          options: {
            emailRedirectTo: new URL(
              `/auth/callback?devam=${encodeURIComponent(hedef)}`,
              publicEnv.siteUrl,
            ).toString(),
          },
        });

        if (error) {
          setHata(authHataMesaji(error));
          return;
        }

        // E-posta doğrulaması açıksa session gelmez; kullanıcıyı
        // beklemeye alıyoruz. Kapalıysa doğrudan içeri alıyoruz.
        if (data.session) {
          router.push(hedef);
          router.refresh();
          return;
        }

        setBilgi(
          `${eposta.trim()} adresine bir doğrulama linki gönderdik. Linke tıkladıktan sonra giriş yapabilirsin.`,
        );
        setSifre("");
      }
    } catch {
      setHata("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div>
      {/* Giriş / Kayıt seçici */}
      <div
        role="tablist"
        aria-label="Giriş yöntemi"
        className="flex rounded-lg border border-stone-300 bg-stone-100 p-1"
      >
        {(
          [
            ["giris", "Giriş yap"],
            ["kayit", "Kayıt ol"],
          ] as const
        ).map(([deger, etiket]) => (
          <button
            key={deger}
            type="button"
            role="tab"
            aria-selected={mod === deger}
            onClick={() => moduDegistir(deger)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mod === deger
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {etiket}
          </button>
        ))}
      </div>

      <form onSubmit={gonder} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="eposta"
            className="block text-sm font-medium text-stone-700"
          >
            E-posta
          </label>
          <input
            id="eposta"
            type="email"
            autoComplete="email"
            required
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
            disabled={calisiyor}
            placeholder="ornek@universite.edu.tr"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-100"
          />
        </div>

        <div>
          <label
            htmlFor="sifre"
            className="block text-sm font-medium text-stone-700"
          >
            Şifre
          </label>
          <input
            id="sifre"
            type="password"
            autoComplete={mod === "giris" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            disabled={calisiyor}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-100"
          />
          {mod === "kayit" ? (
            <p className="mt-1 text-xs text-stone-500">En az 6 karakter.</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={calisiyor}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {calisiyor
            ? "Bekle…"
            : mod === "giris"
              ? "Giriş yap"
              : "Hesap oluştur"}
        </button>
      </form>

      {hata ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {hata}
        </p>
      ) : null}

      {bilgi ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {bilgi}
        </p>
      ) : null}
    </div>
  );
}
