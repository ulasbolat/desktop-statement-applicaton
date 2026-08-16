import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  UretimHatasi,
  kartlariUret,
  sorulariUret,
  type MesajClient,
} from "@/lib/anthropic/generate";

/**
 * Bu testler modelin cevap KALİTESİNİ ölçmüyor (bunun için gerçek API
 * anahtarı gerekir). Ölçtükleri, bizim koda düşen kısım:
 * tool bloğunu ayrıştırma, şema tutmayınca tekrar deneme, bozuk soruyu
 * eleme ve her çağrının loglanması.
 */

const kullanim = {
  input_tokens: 1000,
  output_tokens: 500,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

/** llm_usage_logs'a yazılanları toplayan sahte admin client'ı. */
function sahteAdmin() {
  const yazilanlar: Record<string, unknown>[] = [];
  const admin = {
    from() {
      return {
        insert(kayit: Record<string, unknown>) {
          yazilanlar.push(kayit);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { admin: admin as never, yazilanlar };
}

/** Sırayla verilen cevapları döndüren sahte Claude client'ı. */
function sahteClient(cevaplar: unknown[]) {
  const istekler: Record<string, unknown>[] = [];
  const client: MesajClient = {
    create: ((istek: Record<string, unknown>) => {
      istekler.push(istek);
      const cevap = cevaplar[istekler.length - 1];
      if (!cevap) throw new Error("beklenenden fazla çağrı yapıldı");
      return Promise.resolve(cevap);
    }) as unknown as MesajClient["create"],
  };
  return { client, istekler };
}

function toolCevabi(input: unknown) {
  return {
    content: [{ type: "tool_use", id: "t1", name: "sorulari_kaydet", input }],
    usage: kullanim,
  };
}

const gecerliSoru = {
  soru: "Mitokondrinin temel işlevi nedir?",
  siklar: ["ATP üretimi", "Protein sentezi", "Sindirim", "Fotosentez"],
  dogru_sik: 0,
  aciklama: "Mitokondri hücrenin enerji üretim merkezidir.",
};

describe("sorulariUret", () => {
  it("geçerli cevabı ayrıştırır ve kullanımı loglar", async () => {
    const { admin, yazilanlar } = sahteAdmin();
    const { client } = sahteClient([toolCevabi({ sorular: [gecerliSoru] })]);

    const sonuc = await sorulariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      partiNo: 1,
      adet: 5,
      dersMetni: "ders metni",
      oncekiSorular: [],
    });

    assert.equal(sonuc.length, 1);
    assert.equal(sonuc[0].soru, gecerliSoru.soru);

    assert.equal(yazilanlar.length, 1);
    assert.equal(yazilanlar[0].step, "questions_batch_1");
    assert.equal(yazilanlar[0].input_tokens, 1000);
    assert.ok((yazilanlar[0].estimated_cost_usd as number) > 0);
  });

  it("ders metnini cache'lenecek blokta gönderir", async () => {
    const { admin } = sahteAdmin();
    const { client, istekler } = sahteClient([
      toolCevabi({ sorular: [gecerliSoru] }),
    ]);

    await sorulariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      partiNo: 1,
      adet: 5,
      dersMetni: "ÖZEL DERS METNİ",
      oncekiSorular: [],
    });

    const system = istekler[0].system as { text: string; cache_control?: unknown }[];
    const metinBlogu = system.find((b) => b.text.includes("ÖZEL DERS METNİ"));
    assert.ok(metinBlogu, "ders metni system bloğunda olmalı");
    assert.ok(metinBlogu.cache_control, "ders metni cache'lenmeli");

    // Partiden partiye değişen kısım kullanıcı mesajında olmalı ki
    // cache prefix'i kırılmasın.
    const mesajlar = istekler[0].messages as { content: string }[];
    assert.match(mesajlar[0].content, /5 adet/);

    assert.equal(istekler[0].max_tokens, 4000);
    assert.deepEqual(istekler[0].tool_choice, {
      type: "tool",
      name: "sorulari_kaydet",
    });
  });

  it("önceki soruları isteğe ekler (tekrar üretmesin diye)", async () => {
    const { admin } = sahteAdmin();
    const { client, istekler } = sahteClient([
      toolCevabi({ sorular: [gecerliSoru] }),
    ]);

    await sorulariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      partiNo: 2,
      adet: 5,
      dersMetni: "ders",
      oncekiSorular: ["Ribozom ne yapar?"],
    });

    const mesajlar = istekler[0].messages as { content: string }[];
    assert.match(mesajlar[0].content, /Ribozom ne yapar\?/);
  });

  it("şema tutmazsa bir kez daha dener ve ikinci cevabı kullanır", async () => {
    const { admin, yazilanlar } = sahteAdmin();
    const { client, istekler } = sahteClient([
      toolCevabi({ sorular: [{ ...gecerliSoru, siklar: ["a", "b"] }] }), // bozuk
      toolCevabi({ sorular: [gecerliSoru] }), // düzgün
    ]);

    const sonuc = await sorulariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      partiNo: 1,
      adet: 5,
      dersMetni: "ders",
      oncekiSorular: [],
    });

    assert.equal(sonuc.length, 1);
    assert.equal(istekler.length, 2);

    // İkinci istek modele neyin yanlış gittiğini söylemeli.
    const ikinciMesaj = (istekler[1].messages as { content: string }[])[0];
    assert.match(ikinciMesaj.content, /ÖNEMLİ/);

    // Başarısız deneme de loglanmalı — yakılan token görünmez olmasın.
    assert.equal(yazilanlar.length, 2);
    assert.equal(yazilanlar[1].step, "questions_batch_1_tekrar");
  });

  it("iki deneme de tutmazsa kullanıcıya dönük hata verir", async () => {
    const { admin } = sahteAdmin();
    const { client } = sahteClient([
      toolCevabi({ sorular: [] }),
      toolCevabi({ sorular: [] }),
    ]);

    await assert.rejects(
      () =>
        sorulariUret({
          admin,
          client,
          userId: "u1",
          deckId: "d1",
          partiNo: 1,
          adet: 5,
          dersMetni: "ders",
          oncekiSorular: [],
        }),
      (hata: unknown) => {
        assert.ok(hata instanceof UretimHatasi);
        assert.match(hata.kullaniciMesaji, /Tekrar dene/);
        return true;
      },
    );
  });

  it("tool çağrısı yerine düz metin gelirse tekrar dener", async () => {
    const { admin } = sahteAdmin();
    const { client, istekler } = sahteClient([
      { content: [{ type: "text", text: "İşte sorular: ..." }], usage: kullanim },
      toolCevabi({ sorular: [gecerliSoru] }),
    ]);

    const sonuc = await sorulariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      partiNo: 1,
      adet: 5,
      dersMetni: "ders",
      oncekiSorular: [],
    });

    assert.equal(sonuc.length, 1);
    assert.equal(istekler.length, 2);
  });

  it("aynı şıkkı iki kez içeren soruyu eler", async () => {
    const { admin } = sahteAdmin();
    const { client } = sahteClient([
      toolCevabi({
        sorular: [
          gecerliSoru,
          { ...gecerliSoru, siklar: ["ATP", "ATP", "c", "d"] },
        ],
      }),
    ]);

    const sonuc = await sorulariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      partiNo: 1,
      adet: 5,
      dersMetni: "ders",
      oncekiSorular: [],
    });

    assert.equal(sonuc.length, 1, "bozuk soru elenmeli");
  });

  it("istenenden fazla soru gelirse fazlasını kırpar", async () => {
    const { admin } = sahteAdmin();
    const { client } = sahteClient([
      toolCevabi({
        sorular: Array.from({ length: 9 }, (_, i) => ({
          ...gecerliSoru,
          soru: `${gecerliSoru.soru} (${i})`,
        })),
      }),
    ]);

    const sonuc = await sorulariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      partiNo: 1,
      adet: 5,
      dersMetni: "ders",
      oncekiSorular: [],
    });

    assert.equal(sonuc.length, 5);
  });
});

describe("kartlariUret", () => {
  it("kartları ayrıştırır ve adetle sınırlar", async () => {
    const { admin, yazilanlar } = sahteAdmin();
    const { client } = sahteClient([
      toolCevabi({
        kartlar: Array.from({ length: 20 }, (_, i) => ({
          on: `Kavram ${i}`,
          arka: `Açıklama ${i}`,
        })),
      }),
    ]);

    const sonuc = await kartlariUret({
      admin,
      client,
      userId: "u1",
      deckId: "d1",
      adet: 15,
      dersMetni: "ders",
    });

    assert.equal(sonuc.length, 15);
    assert.equal(yazilanlar[0].step, "flashcards");
  });
});
