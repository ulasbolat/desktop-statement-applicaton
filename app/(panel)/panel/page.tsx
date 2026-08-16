import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DeckCard } from "@/components/deck-card";
import { UploadDropzone } from "@/components/upload-dropzone";
import { gunlukLimitDurumu } from "@/lib/limits";
import { createClient, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Destelerim" };

// Her ziyarette güncel liste ve güncel kalan hak görünsün.
export const dynamic = "force-dynamic";

export default async function PanelSayfasi() {
  const user = await getUser();
  if (!user) redirect("/giris");

  const supabase = await createClient();

  // RLS sayesinde bu sorgu zaten sadece kendi destelerini döner.
  const { data: desteler } = await supabase
    .from("decks")
    .select("*")
    .order("created_at", { ascending: false });

  const limit = await gunlukLimitDurumu(supabase, user.id);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Yeni deste</h1>
        <p className="mt-1 text-sm text-stone-600">
          Ders slaytını yükle, içerikten sorular ve flashcard'lar üretilsin.
        </p>
        <div className="mt-4">
          <UploadDropzone kalanHak={limit.kalan} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Destelerim</h2>

        {desteler && desteler.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {desteler.map((deste) => (
              <li key={deste.id}>
                <DeckCard deste={deste} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
            Henüz desten yok. Yukarıdan ilk PDF'ini yükle.
          </p>
        )}
      </section>
    </div>
  );
}
