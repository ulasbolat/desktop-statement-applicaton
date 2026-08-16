// Test için elle basit PDF üretici. Harici bağımlılık yok.
import { writeFileSync, mkdirSync } from "node:fs";

function pdfKacir(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * @param {string[][]} sayfalar  her sayfa için satır dizisi ([] = boş sayfa)
 */
function pdfOlustur(sayfalar) {
  const nesneler = [];
  const sayfaSayisi = sayfalar.length;

  // 1: Catalog, 2: Pages, 3..: her sayfa için Page + Contents çifti, son: Font
  const fontNo = 3 + sayfaSayisi * 2;
  const sayfaNolari = [];
  for (let i = 0; i < sayfaSayisi; i++) sayfaNolari.push(3 + i * 2);

  nesneler[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  nesneler[2] = `<< /Type /Pages /Kids [${sayfaNolari.map((n) => `${n} 0 R`).join(" ")}] /Count ${sayfaSayisi} >>`;

  sayfalar.forEach((satirlar, i) => {
    const sayfaNo = 3 + i * 2;
    const icerikNo = sayfaNo + 1;

    let akis = "BT\n/F1 12 Tf\n";
    satirlar.forEach((satir, j) => {
      akis += j === 0 ? `50 740 Td\n` : `0 -16 Td\n`;
      akis += `(${pdfKacir(satir)}) Tj\n`;
    });
    akis += "ET";

    nesneler[sayfaNo] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Contents ${icerikNo} 0 R /Resources << /Font << /F1 ${fontNo} 0 R >> >> >>`;
    nesneler[icerikNo] = `<< /Length ${Buffer.byteLength(akis, "latin1")} >>\nstream\n${akis}\nendstream`;
  });

  nesneler[fontNo] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  // Gövdeyi kur, offset'leri kaydet
  let govde = "%PDF-1.4\n";
  const offsetler = [];
  for (let n = 1; n <= fontNo; n++) {
    offsetler[n] = Buffer.byteLength(govde, "latin1");
    govde += `${n} 0 obj\n${nesneler[n]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(govde, "latin1");
  let xref = `xref\n0 ${fontNo + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= fontNo; n++) {
    xref += `${String(offsetler[n]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${fontNo + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(govde + xref, "latin1");
}

const dizin = process.argv[2];
mkdirSync(dizin, { recursive: true });

// 1) Normal ders slaytı — bolca metin (min 500 karakteri rahat geçer)
const dersSatirlari = [
  "Hucre Biyolojisi - Hafta 3",
  "Mitokondri hucrenin enerji uretim merkezidir.",
  "ATP sentezi ic zarda gerceklesir.",
  "Kloroplast sadece bitki hucrelerinde bulunur.",
  "Ribozomlar protein sentezinden sorumludur.",
  "Golgi aygiti proteinleri paketler ve tasir.",
  "Lizozomlar hucre ici sindirimi saglar.",
  "Cekirdek genetik materyali barindirir.",
  "Endoplazmik retikulum granullu ve granulsuz olarak ikiye ayrilir.",
  "Hucre zari secici gecirgen bir yapidadir.",
];
writeFileSync(
  `${dizin}/normal.pdf`,
  pdfOlustur([dersSatirlari, dersSatirlari, dersSatirlari]),
);

// 2) 35 sayfa — sayfa limiti (30) asilmali
writeFileSync(
  `${dizin}/uzun.pdf`,
  pdfOlustur(Array.from({ length: 35 }, () => dersSatirlari)),
);

// 3) Metinsiz (taranmis belge taklidi) — bos sayfalar
writeFileSync(`${dizin}/bos.pdf`, pdfOlustur([[], [], []]));

// 4) PDF olmayan bozuk dosya
writeFileSync(`${dizin}/bozuk.pdf`, Buffer.from("bu bir pdf degil", "utf8"));

// 5) Tam sinirda: 30 sayfa — gecmeli
writeFileSync(
  `${dizin}/tam30.pdf`,
  pdfOlustur(Array.from({ length: 30 }, () => dersSatirlari)),
);

console.log("Test PDF'leri yazildi:", dizin);
