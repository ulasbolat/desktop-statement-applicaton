import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { FlashcardDeck } from "@/components/flashcard-deck";
import { createClient, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kartlar" };

export default async function KartlarSayfasi({
  params,
}: PageProps<"/deste/[id]/kartlar">) {
  const { id } = await params;

  const user = await getUser();
  if (!user) redirect("/giris");

  const supabase = await createClient();

  const { data: deste } = await supabase
    .from("decks")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  if (!deste) notFound();

  const { data: kartlar } = await supabase
    .from("flashcards")
    .select("id, front, back")
    .eq("deck_id", id)
    .order("position");

  return (
    <div>
      <Link
        href={`/deste/${id}`}
        className="text-sm text-stone-500 hover:text-stone-800 hover:underline"
      >
        ← {deste.title}
      </Link>

      <div className="mt-6">
        {kartlar && kartlar.length > 0 ? (
          <FlashcardDeck kartlar={kartlar} />
        ) : (
          <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
            Bu destede henüz kart yok.
          </p>
        )}
      </div>
    </div>
  );
}
