import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { QuizRunner } from "@/components/quiz-runner";
import { createClient, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz" };

export default async function QuizSayfasi({
  params,
}: PageProps<"/deste/[id]/quiz">) {
  const { id } = await params;

  const user = await getUser();
  if (!user) redirect("/giris");

  const supabase = await createClient();

  const { data: deste } = await supabase
    .from("decks")
    .select("id, title, status")
    .eq("id", id)
    .maybeSingle();

  if (!deste) notFound();

  const { data: sorular } = await supabase
    .from("questions")
    .select("id, stem, options, correct_index, explanation")
    .eq("deck_id", id)
    .order("position");

  if (!sorular || sorular.length === 0) {
    return (
      <div>
        <Link
          href={`/deste/${id}`}
          className="text-sm text-stone-500 hover:text-stone-800 hover:underline"
        >
          ← {deste.title}
        </Link>
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
          Bu destede henüz soru yok.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/deste/${id}`}
        className="text-sm text-stone-500 hover:text-stone-800 hover:underline"
      >
        ← {deste.title}
      </Link>

      <div className="mt-6">
        <QuizRunner
          deckId={id}
          sorular={sorular}
          kayitYap
          bitisLinki={`/deste/${id}`}
        />
      </div>
    </div>
  );
}
