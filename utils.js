function strToBuf(str) {
  return new TextEncoder().encode(str);
}

function bufToStr(buf) {
  return new TextDecoder().decode(buf);
}

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function base64urlToBytes(b64url) {
  const pad =
    b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64urlDecodeToString(b64url) {
  const pad =
    b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}

export const getPrivateKeyFromPasscode = async (authProvider, passcode, privateKeyByAuths) => {
  const entryString = privateKeyByAuths[authProvider];
  if (!entryString) {
    throw new Error(`No entry found for auth provider: ${authProvider}`);
  }

  // Parse the stored JSON blob
  const entry = JSON.parse(base64urlDecodeToString(entryString));
  const {
    kdf,
    params: { salt, iter, iv },
    ct,
  } = entry;

  if (kdf !== "pbkdf2-sha256") {
    throw new Error(`Unsupported KDF: ${kdf}`);
  }

  // Derive AES key from passcode
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64urlToBytes(salt),
      iterations: iter,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable so we can reimport
    ["decrypt"]
  );

  // Decrypt the stored privateKey
  const rawKeyBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64urlToBytes(iv) },
    aesKey,
    base64urlToBytes(ct)
  );

  // Import the raw 32-byte privateKey as an AES-GCM key
  const privateKey = await crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  return privateKey; // ready to use with encrypt() / decrypt()
};

export const encrypt = async (key, plaintext) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    strToBuf(plaintext)
  );
  return {
    iv: bufToBase64(iv),
    ciphertext: bufToBase64(encrypted),
  };
};

export const decrypt = async (key, payload) => {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBuf(payload.iv),
    },
    key,
    base64ToBuf(payload.ciphertext)
  );
  return bufToStr(decrypted);
};
