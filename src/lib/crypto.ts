// AES-GCM crypto + channel/key URL packing.
// Channel key lives in URL hash fragment, never sent to any server.

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function generateChannelKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return b64urlEncode(new Uint8Array(raw));
}

export async function importKeyB64(b64: string): Promise<CryptoKey> {
  const raw = b64urlDecode(b64) as BufferSource;
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function fingerprint(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")
    .toUpperCase();
}

export async function encryptJson(key: CryptoKey, obj: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64urlEncode(iv), ct: b64urlEncode(new Uint8Array(ct)) };
}

export async function decryptJson<T = unknown>(key: CryptoKey, payload: { iv: string; ct: string }): Promise<T> {
  const iv = b64urlDecode(payload.iv) as BufferSource;
  const ct = b64urlDecode(payload.ct) as BufferSource;
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(dec.decode(pt));
}

function b64urlEncode(arr: Uint8Array) {
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomId(len = 10) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return b64urlEncode(arr);
}
