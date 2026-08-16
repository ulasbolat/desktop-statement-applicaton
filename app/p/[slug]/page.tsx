import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function desteyiBul(slug: string) {
  const supabase = await createClient();
  // RLS: sadece is_public = true olan desteler anonim kullanıcıya görünür.
  // Paylaşım kapatılırsa bu sorgu boş döner ve sayfa 404 olur.
  const { data } = await supabase
    .from("decks")
    .select("id, title, is_public")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const deste = await desteyiBul(slug);
  return {
    title: deste?.title ?? "Paylaşılan deste",
    description: deste
      ? `${deste.title} — çoktan seçmeli quiz`
      : "Paylaşılan quiz destesi",
  };
}

export default async function PaylasilanDeste({
  params,
}: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const deste = await desteyiBul(slug);

  if (!deste) notFound();

  const supabase = await createClient();
  const [{ count: soruSayisi }, { count: kartSayisi }] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", deste.id),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", deste.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm text-stone-500">Paylaşılan deste</p>
      <h1 className="mt-2 text-3xl font-bold text-balance">{deste.title}</h1>
      <p className="mt-2 text-stone-600">
        {soruSayisi ?? 0} soru{kartSayisi ? ` · ${kartSayisi} kart` : ""}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/p/${slug}/quiz`}
          className="rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Quizi çöz
        </Link>
        <Link
          href="/giris"
          className="rounded-lg border border-stone-300 px-6 py-3 font-medium transition-colors hover:bg-stone-50"
        >
          Kendi desteni oluştur
        </Link>
      </div>

      <p className="mt-6 text-sm text-stone-500">
        Çözmek için giriş yapmana gerek yok. Sonucun kaydedilmez.
      </p>
    </main>
  );
}
