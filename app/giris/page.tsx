import Link from "next/link";
import type { Metadata } from "next";

import { EpostaFormu } from "./eposta-formu";
import { GoogleGirisButonu } from "./google-giris-butonu";

export const metadata: Metadata = { title: "Giriş" };

export default async function GirisSayfasi({
  searchParams,
}: PageProps<"/giris">) {
  const { devam, hata } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="text-sm text-stone-500 hover:text-stone-800 hover:underline"
        >
          ← Ana sayfa
        </Link>

        <h1 className="mt-6 text-2xl font-bold">Giriş yap</h1>
        <p className="mt-2 text-sm text-stone-600">
          Destelerini kaydetmek ve tekrar kuyruğunu takip etmek için giriş
          yapman gerekiyor.
        </p>

        {/* Bir bilgi: Google ve e-posta aynı adrese bağlıysa Supabase iki
            yöntemi tek hesapta birleştirir; ayrı hesap oluşmaz. */}

        {hata ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Giriş tamamlanamadı. Lütfen tekrar dene.
          </p>
        ) : null}

        <div className="mt-8">
          <GoogleGirisButonu devam={typeof devam === "string" ? devam : null} />
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-stone-200" />
          <span className="text-xs text-stone-500">veya e-posta ile</span>
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <EpostaFormu devam={typeof devam === "string" ? devam : null} />

        <p className="mt-6 text-xs leading-relaxed text-stone-500">
          Giriş yaparak yüklediğin dosyaların soru üretmek için işlenmesini
          kabul etmiş olursun. PDF’lerin başkalarıyla paylaşılmaz.
        </p>
      </div>
    </main>
  );
}
