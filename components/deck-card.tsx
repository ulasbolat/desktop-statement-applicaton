import Link from "next/link";

import type { Deck, DeckStatus } from "@/types/database";

const DURUM_ETIKETI: Record<DeckStatus, { metin: string; sinif: string }> = {
  pending: { metin: "Sırada", sinif: "bg-stone-100 text-stone-700" },
  extracting: { metin: "Okunuyor", sinif: "bg-amber-100 text-amber-800" },
  generating: { metin: "Sorular hazırlanıyor", sinif: "bg-amber-100 text-amber-800" },
  ready: { metin: "Hazır", sinif: "bg-emerald-100 text-emerald-800" },
  failed: { metin: "Başarısız", sinif: "bg-red-100 text-red-800" },
};

export function DeckCard({ deste }: { deste: Deck }) {
  const durum = DURUM_ETIKETI[deste.status];

  return (
    <Link
      href={`/deste/${deste.id}`}
      className="block rounded-xl border border-stone-200 bg-white p-5 transition-colors hover:border-stone-300 hover:bg-stone-50"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-medium text-balance">{deste.title}</h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${durum.sinif}`}
        >
          {durum.metin}
        </span>
      </div>

      <p className="mt-2 text-xs text-stone-500">
        {new Date(deste.created_at).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {deste.is_public ? " · paylaşımda" : ""}
      </p>

      {deste.status === "failed" && deste.error_message ? (
        <p className="mt-2 text-sm text-red-700">{deste.error_message}</p>
      ) : null}
    </Link>
  );
}
