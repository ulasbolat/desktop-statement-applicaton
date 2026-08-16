import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { QuizRunner } from "@/components/quiz-runner";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz" };

export default async function PaylasilanQuiz({
  params,
}: PageProps<"/p/[slug]/quiz">) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data: deste } = await supabase
    .from("decks")
    .select("id, title")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!deste) notFound();

  const { data: sorular } = await supabase
    .from("questions")
    .select("id, stem, options, correct_index, explanation")
    .eq("deck_id", deste.id)
    .order("position");

  if (!sorular || sorular.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <Link
        href={`/p/${slug}`}
        className="text-sm text-stone-500 hover:text-stone-800 hover:underline"
      >
        ← {deste.title}
      </Link>

      <div className="mt-6">
        {/* kayitYap=false: anonim çözümde sonuç kaydedilmiyor. */}
        <QuizRunner
          deckId={deste.id}
          sorular={sorular}
          kayitYap={false}
          bitisLinki={`/p/${slug}`}
        />
      </div>
    </main>
  );
}
