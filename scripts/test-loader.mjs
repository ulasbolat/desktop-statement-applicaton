/**
 * node:test için minik modül çözücü.
 *
 * İki şey yapıyor:
 *  1. "@/lib/x" gibi tsconfig alias'larını dosya yoluna çeviriyor
 *  2. Uzantısız import'lara .ts / .tsx ekliyor
 *
 * Node 22 TypeScript'i doğrudan çalıştırabildiği için ayrıca derleyiciye
 * gerek yok. "server-only" paketi de --conditions=react-server ile boş
 * modüle düşüyor (testleri o bayrakla çalıştır).
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const kok = pathToFileURL(`${process.cwd()}/`);

function uzantiEkle(url) {
  const yol = fileURLToPath(url);
  // Dizinlere dokunma — test koşucusu dizin geçtiğinde araya girmeyelim.
  if (existsSync(yol) && statSync(yol).isDirectory()) return url;
  if (existsSync(yol)) return url;
  for (const ek of [".ts", ".tsx", "/index.ts"]) {
    if (existsSync(yol + ek)) return `${url}${ek}`;
  }
  return url;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const hedef = new URL(specifier.slice(2), kok).href;
    return next(uzantiEkle(hedef), context);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const temel = context.parentURL ?? kok.href;
    const hedef = new URL(specifier, temel).href;
    if (hedef.startsWith("file:")) return next(uzantiEkle(hedef), context);
  }
  return next(specifier, context);
}
