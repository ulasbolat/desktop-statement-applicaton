import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"], // latin-ext: ş, ğ, ı, İ, ç, ö, ü
});

export const metadata: Metadata = {
  title: {
    default: "Slayttan Quiz",
    template: "%s · Slayttan Quiz",
  },
  description:
    "Ders slaytını yükle, saniyeler içinde çoktan seçmeli soru ve flashcard'a dönüşsün. Yanlışların aralıklı tekrarla karşına çıksın.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-stone-50 text-stone-900 min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
