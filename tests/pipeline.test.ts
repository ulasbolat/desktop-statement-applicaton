import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ilerlemeHesapla, sonrakiAdim } from "@/lib/deck-pipeline";
import { istanbulGunBaslangici } from "@/lib/limits";
import { siklarBenzersizMi, sorularSemasi } from "@/lib/anthropic/schemas";
import { maliyetHesapla } from "@/lib/usage";

describe("sonrakiAdim — üretim hangi adımda?", () => {
  it("hiç soru yokken ilk partiden başlar", () => {
    assert.deepEqual(sonrakiAdim(0, 0), {
      tur: "sorular",
      partiNo: 1,
      adet: 5,
    });
  });

  it("5 soru varken ikinci partiye geçer", () => {
    assert.deepEqual(sonrakiAdim(5, 0), {
      tur: "sorular",
      partiNo: 2,
      adet: 5,
    });
  });

  it("son partide sadece eksik kalan kadar ister", () => {
    // 18 soru varsa 20'ye tamamlamak için 2 tane yeter, 5 değil.
    assert.deepEqual(sonrakiAdim(18, 0), {
      tur: "sorular",
      partiNo: 4,
      adet: 2,
    });
  });

  it("20 soru tamamlanınca kartlara geçer", () => {
    assert.deepEqual(sonrakiAdim(20, 0), { tur: "kartlar" });
  });

  it("kartlar da varsa biter", () => {
    assert.deepEqual(sonrakiAdim(20, 15), { tur: "bitti" });
  });

  it("beklenenden fazla soru varsa yine de kartlara geçer", () => {
    assert.deepEqual(sonrakiAdim(23, 0), { tur: "kartlar" });
  });
});

describe("ilerlemeHesapla", () => {
  it("baştan sona 0'dan 100'e çıkar", () => {
    assert.equal(ilerlemeHesapla(0, 0), 0);
    assert.equal(ilerlemeHesapla(10, 0), 40);
    assert.equal(ilerlemeHesapla(20, 0), 80);
    assert.equal(ilerlemeHesapla(20, 15), 100);
  });

  it("100'ü aşmaz", () => {
    assert.equal(ilerlemeHesapla(50, 50), 100);
  });
});

describe("istanbulGunBaslangici", () => {
  it("Türkiye saatiyle gün başını UTC olarak verir", () => {
    // 16 Ağustos 23:36 UTC = 17 Ağustos 02:36 TR
    // → TR günü 17 Ağustos 00:00 = 16 Ağustos 21:00 UTC
    const sonuc = istanbulGunBaslangici(new Date("2026-08-16T23:36:00Z"));
    assert.equal(sonuc.toISOString(), "2026-08-16T21:00:00.000Z");
  });

  it("TR gün ortasında aynı günü verir", () => {
    // 16 Ağustos 12:00 UTC = 15:00 TR → gün başı 16 Ağustos 00:00 TR
    const sonuc = istanbulGunBaslangici(new Date("2026-08-16T12:00:00Z"));
    assert.equal(sonuc.toISOString(), "2026-08-15T21:00:00.000Z");
  });

  it("TR gece yarısından hemen sonra yeni güne geçer", () => {
    const oncesi = istanbulGunBaslangici(new Date("2026-08-16T20:59:00Z"));
    const sonrasi = istanbulGunBaslangici(new Date("2026-08-16T21:01:00Z"));
    assert.notEqual(oncesi.toISOString(), sonrasi.toISOString());
  });
});

describe("soru şeması — Claude'dan geleni doğrula", () => {
  const gecerli = {
    sorular: [
      {
        soru: "Mitokondrinin temel işlevi nedir?",
        siklar: ["ATP üretimi", "Protein sentezi", "Sindirim", "Fotosentez"],
        dogru_sik: 0,
        aciklama: "Mitokondri hücrenin enerji üretim merkezidir.",
      },
    ],
  };

  it("geçerli çıktıyı kabul eder", () => {
    assert.equal(sorularSemasi.safeParse(gecerli).success, true);
  });

  it("3 şıklı soruyu reddeder", () => {
    const bozuk = {
      sorular: [{ ...gecerli.sorular[0], siklar: ["a", "b", "c"] }],
    };
    assert.equal(sorularSemasi.safeParse(bozuk).success, false);
  });

  it("aralık dışı doğru şıkkı reddeder", () => {
    const bozuk = { sorular: [{ ...gecerli.sorular[0], dogru_sik: 4 }] };
    assert.equal(sorularSemasi.safeParse(bozuk).success, false);
  });

  it("boş soru kökünü reddeder", () => {
    const bozuk = { sorular: [{ ...gecerli.sorular[0], soru: "kısa" }] };
    assert.equal(sorularSemasi.safeParse(bozuk).success, false);
  });

  it("hiç soru yoksa reddeder", () => {
    assert.equal(sorularSemasi.safeParse({ sorular: [] }).success, false);
  });
});

describe("siklarBenzersizMi", () => {
  it("farklı şıkları geçirir", () => {
    assert.equal(siklarBenzersizMi(["a", "b", "c", "d"]), true);
  });

  it("aynı şıkkı yakalar", () => {
    assert.equal(siklarBenzersizMi(["ATP", "ATP", "c", "d"]), false);
  });

  it("sadece büyük/küçük harf farkını da yakalar (Türkçe)", () => {
    assert.equal(siklarBenzersizMi(["İzmir", "izmir", "c", "d"]), false);
  });

  it("baştaki/sondaki boşluk farkını yakalar", () => {
    assert.equal(siklarBenzersizMi(["ATP ", "ATP", "c", "d"]), false);
  });
});

describe("maliyetHesapla", () => {
  const bosUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  it("girdi ve çıktıyı doğru fiyatlar", () => {
    // 1M girdi = 3$, 1M çıktı = 15$
    const maliyet = maliyetHesapla("claude-sonnet-4-6", {
      ...bosUsage,
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    } as never);
    assert.equal(maliyet, 18);
  });

  it("cache okumayı 1/10 fiyatlar", () => {
    const cacheli = maliyetHesapla("claude-sonnet-4-6", {
      ...bosUsage,
      cache_read_input_tokens: 1_000_000,
    } as never);
    assert.equal(cacheli, 0.3);
  });

  it("cache yazmayı 1.25 kat fiyatlar", () => {
    const yazma = maliyetHesapla("claude-sonnet-4-6", {
      ...bosUsage,
      cache_creation_input_tokens: 1_000_000,
    } as never);
    assert.equal(yazma, 3.75);
  });

  it("bilinmeyen modelde varsayılan fiyatı kullanır (0 dönmez)", () => {
    const maliyet = maliyetHesapla("bilinmeyen-model", {
      ...bosUsage,
      input_tokens: 1_000_000,
    } as never);
    assert.ok(maliyet > 0);
  });
});
