import Link from "next/link";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase/server";

/**
 * Giriş zorunlu route grubu. proxy.ts zaten çeviriyor ama burada da
 * kontrol ediyoruz — proxy bir güvenlik sınırı değil, tek savunma hattı
 * olmamalı.
 */
export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/giris");

  const isim =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "Hesabım";

  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Link href="/panel" className="font-semibold">
            Slayttan Quiz
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/panel" className="text-stone-600 hover:text-stone-900">
              Destelerim
            </Link>
            <Link href="/tekrar" className="text-stone-600 hover:text-stone-900">
              Tekrar
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-stone-500 sm:inline">
              {isim}
            </span>
            <form action="/auth/cikis" method="post">
              <button
                type="submit"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
              >
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </>
  );
}
