/**
 * test-loader.mjs'i modül çözücü olarak kaydeder.
 *
 * `--import` tek başına dosyayı sadece çalıştırır; çözücü olarak devreye
 * girmesi için register() çağrısı gerekiyor.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./test-loader.mjs", pathToFileURL(`${import.meta.dirname}/`));
