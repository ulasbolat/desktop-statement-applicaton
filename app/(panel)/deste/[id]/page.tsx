import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { GenerationStatus } from "@/components/generation-status";
import { createClient, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/deste/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("decks")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title ?? "Deste" };
}

export default async function DesteSayfasi({
  params,
}: PageProps<"/deste/[id]">) {
  const { id } = await params;

  const user = await getUser();
  if (!user) redirect("/giris");

  const supabase = await createClient();

  const { data: deste } = await supabase
    .from("decks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!deste) notFound();

  const [{ count: soruSayisi }, { count: kartSayisi }] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", id),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", id),
  ]);

  const hazir = deste.status === "ready";

  return (
    <div>
      <Link
        href="/panel"
        className="text-sm text-stone-500 hover:text-stone-800 hover:underline"
      >
        ← Destelerim
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-balance">{deste.title}</h1>
      <p className="mt-1 text-sm text-stone-600">
        {soruSayisi ?? 0} soru · {kartSayisi ?? 0} kart
      </p>

      <div className="mt-6">
        {/* Deste hazır değilse üretim adımlarını bu bileşen sürüyor. */}
        <GenerationStatus
          deckId={deste.id}
          baslangicDurumu={deste.status}
          baslangicIlerleme={deste.progress}
          baslangicHata={deste.error_message}
        />
      </div>

      {hazir ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/deste/${deste.id}/quiz`}
            className="rounded-xl border border-stone-200 bg-white p-6 transition-colors hover:border-stone-300 hover:bg-stone-50"
          >
            <p className="font-semibold">Quiz çöz</p>
            <p className="mt-1 text-sm text-stone-600">
              {soruSayisi ?? 0} çoktan seçmeli soru, anında geri bildirim.
            </p>
          </Link>

          <Link
            href={`/deste/${deste.id}/kartlar`}
            className="rounded-xl border border-stone-200 bg-white p-6 transition-colors hover:border-stone-300 hover:bg-stone-50"
          >
            <p className="font-semibold">Kartları çalış</p>
            <p className="mt-1 text-sm text-stone-600">
              {kartSayisi ?? 0} flashcard ile hızlı tekrar.
            </p>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
