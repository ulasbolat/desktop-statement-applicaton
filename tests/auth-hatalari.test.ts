import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { authHataMesaji, formHatasi } from "@/lib/auth-hatalari";

describe("authHataMesaji — koda göre", () => {
  it("yanlış şifre", () => {
    assert.equal(
      authHataMesaji({ code: "invalid_credentials" }),
      "E-posta veya şifre hatalı.",
    );
  });

  it("doğrulanmamış e-posta", () => {
    assert.match(
      authHataMesaji({ code: "email_not_confirmed" }),
      /doğrulamamışsın/,
    );
  });

  it("zaten kayıtlı e-posta", () => {
    assert.match(authHataMesaji({ code: "user_already_exists" }), /zaten kayıtlı/);
    assert.match(authHataMesaji({ code: "email_exists" }), /zaten kayıtlı/);
  });

  it("zayıf şifre", () => {
    assert.match(authHataMesaji({ code: "weak_password" }), /en az 6 karakter/i);
  });

  it("e-posta girişi kapalıysa Google'a yönlendirir", () => {
    assert.match(
      authHataMesaji({ code: "email_provider_disabled" }),
      /Google/,
    );
  });
});

describe("authHataMesaji — kod yoksa mesaj metnine bakar", () => {
  it("Invalid login credentials", () => {
    assert.equal(
      authHataMesaji({ message: "Invalid login credentials" }),
      "E-posta veya şifre hatalı.",
    );
  });

  it("User already registered", () => {
    assert.match(
      authHataMesaji({ message: "User already registered" }),
      /zaten kayıtlı/,
    );
  });

  it("Password should be at least 6 characters", () => {
    assert.match(
      authHataMesaji({ message: "Password should be at least 6 characters" }),
      /en az 6 karakter/i,
    );
  });
});

describe("authHataMesaji — son çare", () => {
  it("429 için bekleme mesajı", () => {
    assert.match(authHataMesaji({ status: 429 }), /bekleyip tekrar dene/);
  });

  it("5xx için sunucu mesajı", () => {
    assert.match(authHataMesaji({ status: 500 }), /Sunucuya ulaşılamadı/);
  });

  it("hiçbir şey bilinmiyorsa genel mesaj", () => {
    assert.match(authHataMesaji({}), /Beklenmeyen bir hata/);
    assert.match(authHataMesaji(null), /Beklenmeyen bir hata/);
  });

  it("her durumda Türkçe ve boş olmayan bir cümle döner", () => {
    for (const girdi of [
      null,
      undefined,
      {},
      { code: "bilinmeyen_kod" },
      { message: "something weird" },
      { status: 418 },
    ]) {
      const mesaj = authHataMesaji(girdi);
      assert.ok(mesaj.length > 10, `boş mesaj: ${JSON.stringify(girdi)}`);
    }
  });
});

describe("formHatasi", () => {
  it("boş e-postayı yakalar", () => {
    assert.match(formHatasi("", "123456")!, /E-posta adresini gir/);
  });

  it("bozuk e-postayı yakalar", () => {
    assert.match(formHatasi("ahmet@", "123456")!, /Geçerli bir e-posta/);
    assert.match(formHatasi("ahmet", "123456")!, /Geçerli bir e-posta/);
  });

  it("kısa şifreyi yakalar", () => {
    assert.match(formHatasi("ahmet@ornek.com", "123")!, /en az 6 karakter/i);
  });

  it("geçerli girdide null döner", () => {
    assert.equal(formHatasi("ahmet@ornek.com", "123456"), null);
    assert.equal(formHatasi("  ahmet@ornek.com  ", "uzunsifre"), null);
  });
});
