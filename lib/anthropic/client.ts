import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { serverEnv } from "@/lib/env";

let onbellek: Anthropic | null = null;

export function anthropicClient(): Anthropic {
  if (!onbellek) {
    onbellek = new Anthropic({
      apiKey: serverEnv().anthropicApiKey,
      // Vercel Hobby'de fonksiyon 60 sn'de kesiliyor. SDK'yı biraz önce
      // bırakırsak platform bizi öldürmeden düzgün bir hata yakalayabiliyoruz.
      timeout: 50_000,
      maxRetries: 1,
    });
  }
  return onbellek;
}

export function anthropicModel(): string {
  return serverEnv().anthropicModel;
}
