import type { Metadata } from "next";

import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Destelerim" };

export default async function PanelSayfasi() {
  const user = await getUser();

  return (
    <div>
      <h1 className="text-2xl font-bold">Destelerim</h1>
      <p className="mt-1 text-sm text-stone-600">
        Hoş geldin{user?.email ? `, ${user.email}` : ""}.
      </p>

      {/* Adım 3'te buraya yükleme alanı, Adım 4'te deste listesi gelecek. */}
      <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="font-medium">Henüz desten yok</p>
        <p className="mt-1 text-sm text-stone-600">
          PDF yükleme özelliği bir sonraki adımda ekleniyor.
        </p>
      </div>
    </div>
  );
}
