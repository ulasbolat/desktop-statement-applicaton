import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TAMAMLANDI_STAGE,
  ilkYanlis,
  sonrakiTekrar,
  tamamlandiMi,
  tekrarZamaniMetni,
} from "@/lib/srs";

const SIMDI = new Date("2026-08-16T10:00:00Z");
const GUN_MS = 24 * 60 * 60 * 1000;

function gunFarki(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / GUN_MS);
}

describe("ilkYanlis", () => {
  it("yanlış yapılan soruyu 1 gün sonrasına koyar", () => {
    const sonuc = ilkYanlis(SIMDI);
    assert.equal(sonuc.stage, 0);
    assert.equal(gunFarki(sonuc.dueAt, SIMDI), 1);
  });
});

describe("sonrakiTekrar — 1/3/7 gün merdiveni", () => {
  it("stage 0'da doğru cevap → 3 gün sonra", () => {
    const sonuc = sonrakiTekrar(0, true, SIMDI);
    assert.equal(sonuc.stage, 1);
    assert.equal(gunFarki(sonuc.dueAt, SIMDI), 3);
  });

  it("stage 1'de doğru cevap → 7 gün sonra", () => {
    const sonuc = sonrakiTekrar(1, true, SIMDI);
    assert.equal(sonuc.stage, 2);
    assert.equal(gunFarki(sonuc.dueAt, SIMDI), 7);
  });

  it("stage 2'de doğru cevap → tamamlandı", () => {
    const sonuc = sonrakiTekrar(2, true, SIMDI);
    assert.equal(sonuc.stage, TAMAMLANDI_STAGE);
    assert.equal(tamamlandiMi(sonuc.stage), true);
  });

  it("baştan sona 1 → 3 → 7 → bitti sırası", () => {
    let durum = ilkYanlis(SIMDI);
    assert.equal(gunFarki(durum.dueAt, SIMDI), 1);

    durum = sonrakiTekrar(durum.stage, true, SIMDI);
    assert.equal(gunFarki(durum.dueAt, SIMDI), 3);

    durum = sonrakiTekrar(durum.stage, true, SIMDI);
    assert.equal(gunFarki(durum.dueAt, SIMDI), 7);

    durum = sonrakiTekrar(durum.stage, true, SIMDI);
    assert.equal(tamamlandiMi(durum.stage), true);
  });
});

describe("sonrakiTekrar — yanlış cevap", () => {
  it("stage 1'de yanlış → başa döner (1 gün)", () => {
    const sonuc = sonrakiTekrar(1, false, SIMDI);
    assert.equal(sonuc.stage, 0);
    assert.equal(gunFarki(sonuc.dueAt, SIMDI), 1);
  });

  it("stage 2'de yanlış → yine başa döner", () => {
    const sonuc = sonrakiTekrar(2, false, SIMDI);
    assert.equal(sonuc.stage, 0);
    assert.equal(gunFarki(sonuc.dueAt, SIMDI), 1);
  });

  it("son aşamaya gelmiş soru yanlışta kuyruğa geri girer", () => {
    const sonuc = sonrakiTekrar(TAMAMLANDI_STAGE, false, SIMDI);
    assert.equal(tamamlandiMi(sonuc.stage), false);
  });
});

describe("tamamlandiMi", () => {
  it("3 ve üzeri tamamlanmıştır", () => {
    assert.equal(tamamlandiMi(0), false);
    assert.equal(tamamlandiMi(2), false);
    assert.equal(tamamlandiMi(3), true);
  });
});

describe("tekrarZamaniMetni", () => {
  it("yarın için 'Yarın' der", () => {
    const yarin = new Date(SIMDI.getTime() + GUN_MS);
    assert.equal(tekrarZamaniMetni(0, SIMDI, yarin), "Yarın tekrar çıkacak");
  });

  it("geçmiş tarih için 'şimdi' der", () => {
    const dun = new Date(SIMDI.getTime() - GUN_MS);
    assert.equal(tekrarZamaniMetni(0, SIMDI, dun), "Şimdi tekrar edilebilir");
  });

  it("tamamlanmış soru için öğrenildi der", () => {
    assert.match(tekrarZamaniMetni(TAMAMLANDI_STAGE, SIMDI), /öğrendin/);
  });

  it("3 gün sonrası için gün sayısını söyler", () => {
    const ucGunSonra = new Date(SIMDI.getTime() + 3 * GUN_MS);
    assert.equal(
      tekrarZamaniMetni(1, SIMDI, ucGunSonra),
      "3 gün sonra tekrar çıkacak",
    );
  });
});
