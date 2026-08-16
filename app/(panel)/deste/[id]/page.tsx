import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <Link
        href="/panel"
        className="text-sm text-stone-500 hover:text-stone-800 hover:underline"
      >
        ← Destelerim
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-balance">{deste.title}</h1>

      {/* Üretim akışı ve quiz bağlantıları Adım 4-5'te buraya gelecek. */}
      <p className="mt-4 rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        Durum: <strong>{deste.status}</strong>
        {deste.error_message ? (
          <>
            <br />
            {deste.error_message}
          </>
        ) : null}
      </p>
    </div>
  );
}
