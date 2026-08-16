import Link from "next/link";

import { getUser } from "@/lib/supabase/server";

const ADIMLAR = [
  {
    baslik: "PDF'ini yükle",
    metin: "Ders slaytın ya da notun. En fazla 30 sayfa, 10 MB.",
  },
  {
    baslik: "Sorular hazırlansın",
    metin: "İçerikten 20 çoktan seçmeli soru ve flashcard üretilir.",
  },
  {
    baslik: "Çöz, tekrar et, paylaş",
    metin:
      "Yanlışların 1, 3 ve 7 gün sonra tekrar karşına çıkar. Desteni linkle arkadaşlarına gönder.",
  },
];

export default async function AnaSayfa() {
  const user = await getUser();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
        <p className="text-sm font-medium tracking-wide text-emerald-700 uppercase">
          Üniversite öğrencileri için
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Ders slaytını quize çevir
        </h1>
        <p className="mt-5 text-lg text-pretty text-stone-600">
          PDF'ini yükle, sistem içerikten çoktan seçmeli sorular ve flashcard'lar
          üretsin. Yanlış yaptığın sorular aralıklı tekrar kuyruğuna girsin.
        </p>

        <div className="mt-8">
          <Link
            href={user ? "/panel" : "/giris"}
            className="inline-flex items-center rounded-lg bg-emerald-700 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-emerald-800"
          >
            {user ? "Panele git" : "Google ile başla"}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <ol className="grid gap-6 sm:grid-cols-3">
          {ADIMLAR.map((adim, i) => (
            <li
              key={adim.baslik}
              className="rounded-xl border border-stone-200 bg-white p-6"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                {i + 1}
              </span>
              <h2 className="mt-4 font-semibold">{adim.baslik}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {adim.metin}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
