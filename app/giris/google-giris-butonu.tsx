"use client";

import { useState } from "react";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export function GoogleGirisButonu({ devam }: { devam: string | null }) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function girisYap() {
    setYukleniyor(true);
    setHata(null);

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", publicEnv.siteUrl);
    if (devam?.startsWith("/")) {
      // Sadece kendi sitemize dönebiliriz — açık yönlendirme (open redirect)
      // açığı olmasın diye "/" ile başlamayan değerler yok sayılıyor.
      callbackUrl.searchParams.set("devam", devam);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error) {
      setHata("Google'a bağlanılamadı. İnternet bağlantını kontrol et.");
      setYukleniyor(false);
    }
    // Hata yoksa tarayıcı Google'a yönleniyor, bu bileşen kayboluyor.
  }

  return (
    <div>
      <button
        type="button"
        onClick={girisYap}
        disabled={yukleniyor}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-white px-4 py-3 font-medium transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleLogo />
        {yukleniyor ? "Yönlendiriliyor…" : "Google ile devam et"}
      </button>

      {hata ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {hata}
        </p>
      ) : null}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.55-2.03-6.46-4.76H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.54 14.16a6.9 6.9 0 0 1 0-4.4V6.78H1.7a11.5 11.5 0 0 0 0 10.36l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.79c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.31 15.11.25 12 .25 7.5.25 3.62 2.84 1.7 6.78l3.84 2.98C6.45 6.82 9 4.79 12 4.79Z"
      />
    </svg>
  );
}
