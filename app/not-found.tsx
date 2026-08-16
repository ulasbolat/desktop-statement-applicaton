import Link from "next/link";

export default function BulunamadiSayfasi() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="text-center">
        <p className="text-sm font-medium text-stone-500">404</p>
        <h1 className="mt-2 text-2xl font-bold">Sayfa bulunamadı</h1>
        <p className="mt-2 text-stone-600">
          Aradığın sayfa taşınmış olabilir. Paylaşılan bir deste arıyorsan
          linkin sahibi paylaşımı kapatmış olabilir.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
