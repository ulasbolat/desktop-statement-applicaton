import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ReviewRunner, type TekrarSorusu } from "@/components/review-runner";
import { TAMAMLANDI_STAGE } from "@/lib/srs";
import { createClient, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tekrar" };

export default async function TekrarSayfasi() {
  const user = await getUser();
  if (!user) redirect("/giris");

  const supabase = await createClient();

  // Vakti gelmiş tekrarlar. RLS zaten kullanıcıyı filtreliyor.
  const { data: kayitlar } = await supabase
    .from("reviews")
    .select(
      "question_id, stage, due_at, questions(id, stem, options, correct_index, explanation), decks(title)",
    )
    .lt("stage", TAMAMLANDI_STAGE)
    .lte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(30);

  const sorular: TekrarSorusu[] = (kayitlar ?? [])
    .map((k) => {
      const soru = k.questions;
      const deste = k.decks;
      if (!soru || !deste) return null;
      return {
        id: soru.id,
        stem: soru.stem,
        options: soru.options,
        correct_index: soru.correct_index,
        explanation: soru.explanation,
        deckTitle: deste.title,
      };
    })
    .filter((s): s is TekrarSorusu => s !== null);

  // Bekleyen (vakti gelmemiş) tekrar var mı?
  const { count: bekleyen } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .lt("stage", TAMAMLANDI_STAGE)
    .gt("due_at", new Date().toISOString());

  return (
    <div>
      <h1 className="text-2xl font-bold">Tekrar</h1>
      <p className="mt-1 text-sm text-stone-600">
        Yanlış yaptığın sorular 1, 3 ve 7 gün aralıklarla karşına çıkar.
      </p>

      <div className="mt-6">
        {sorular.length > 0 ? (
          <ReviewRunner sorular={sorular} />
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <p className="font-medium">Bugün tekrar edilecek soru yok</p>
            <p className="mt-1 text-sm text-stone-600">
              {bekleyen && bekleyen > 0
                ? `${bekleyen} soru sırada — vakitleri gelince burada görünecek.`
                : "Bir quiz çözdüğünde yanlışların buraya düşecek."}
            </p>
            <Link
              href="/panel"
              className="mt-5 inline-block rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
            >
              Destelerime git
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
