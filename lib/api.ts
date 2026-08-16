import { NextResponse } from "next/server";

/**
 * API cevapları için tek tip zarf. `hata` alanı doğrudan kullanıcıya
 * gösterilebilecek Türkçe bir cümle, `kod` ise istemcinin dallanabilmesi
 * için makine tarafı.
 */
export type ApiHata = { hata: string; kod?: string };

export function hataCevabi(mesaj: string, durum: number, kod?: string) {
  return NextResponse.json<ApiHata>({ hata: mesaj, kod }, { status: durum });
}

export function girisGerekli() {
  return hataCevabi("Bu işlem için giriş yapman gerekiyor.", 401, "giris_yok");
}

export function sunucuHatasi(hata: unknown) {
  // Ayrıntı sunucu log'una, kullanıcıya genel mesaj — iç detay sızmasın.
  console.error("[api] beklenmeyen hata:", hata);
  return hataCevabi(
    "Beklenmeyen bir hata oldu. Birazdan tekrar dene.",
    500,
    "sunucu",
  );
}

/** JSON gövdeyi güvenle okur; bozuksa null döner. */
export async function govdeyiOku(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
