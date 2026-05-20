# @dreamworld/vault

A browser-side secure storage library that persists key/value data in `localStorage`, mirrors it through cross-tab `@dreamworld/session-storage`, and optionally encrypts persisted values with AES-GCM 256 using a private key derived from a passcode via PBKDF2-SHA256.

---

## 1. User Guide

### Installation & Setup

The package is published as `@dreamworld/vault` (see `package.json#name`) and ships ESM (`"type": "module"`, `"main": "vault.js"`). Install instructions beyond the package name are **Not determinable from provided source.**

Runtime dependencies declared in `package.json`:

| Dependency | Version |
|---|---|
| `@dreamworld/event-emitter` | `^1.1.0` |
| `@dreamworld/session-storage` | `^1.0.0-init.3` |
| `lodash-es` | `^4.17.21` |

Dev scripts (from `package.json#scripts`):

```bash
# Run the demo at /demo/ with auto-reload
npm run start

# Dev server without auto-opening a browser
npm run dev

# Static dev server
npm run serve
```

There is no `test` script (`"test": "echo \"Error: no test specified\" && exit 1"`).

### Basic Usage

The default export is the `Vault` class. It is instantiated with `new Vault()` (no constructor arguments — `vault.js:67`); state is loaded from `localStorage` and `@dreamworld/session-storage` automatically.

```javascript
import Vault from '@dreamworld/vault';

const vault = new Vault();

// Insecure mode (no keys configured) — store and read plaintext immediately
vault.store('theme', 'dark');
console.log(vault.get('theme')); // 'dark'

// Promote to secure mode using a `{ authProvider: encryptedPrivateKeyBlob }` map
await vault.secure(
  { password: '<base64url-encoded-encrypted-private-key-blob>' },
  'password',
  'my-passcode'
);

// Lock and unlock
await vault.lock();
await vault.unlock('password', 'my-passcode');

// React to state transitions
vault.on('unlock', () => console.log('unlocked'));
vault.on('lock',   () => console.log('locked'));
```

### API Reference

#### Class: `Vault` (default export of `vault.js`)

Extends `EventEmitter` from `@dreamworld/event-emitter`.

##### Static members

| Name | Value | Description |
|---|---|---|
| `Vault.prefix` | `'vault'` | Prefix applied to all keys written to `localStorage` / session storage. |
| `Vault.dataPrefix` | `'vault_data_'` | Prefix applied to user-stored data keys. |
| `Vault.defaultSettings` | `{ autoLockTimeout: 0 }` | Defaults merged with persisted settings during `_init`. |

##### Instance methods

| Method | Signature | Returns | Description |
|---|---|---|---|
| `constructor` | `new Vault()` | `Vault` | Loads keys/settings from `localStorage`, hydrates session storage, syncs unlock state across tabs, and installs auto-lock listeners. |
| `unlock` | `unlock(keyName: string, passcode: string)` | `Promise<true>` | Derives the private key from the named `keys[keyName]` entry and `passcode`, decrypts all `vault_data_*` entries into session storage, and emits `'unlock'`. Throws `{ code: 'INVALID_PASSCODE', message: 'Invalid passcode' }` on failure. |
| `lock` | `lock()` | `Promise<void>` | Clears in-memory session data, drops the unlock key, emits `'lock'`. Throws `Error('Cannot lock an insecure vault')` if not secure. |
| `secure` | `secure(keys: Object, keyName: string, passcode: string)` | `Promise<void>` | Derives the unlock key from `keys[keyName]` + `passcode`, encrypts all existing in-memory data into `localStorage`, persists `keys`, broadcasts the unlock key across tabs, emits `'secure'`. Throws `Error('Vault is already secure')` if already secure. |
| `insecure` | `insecure()` | `Promise<void>` | Decrypts every `vault_data_*` entry back to plaintext in `localStorage`, removes the keys, clears the unlock state, emits `'insecure'`. No-op if already insecure. Throws `Error('Vault is locked. Unlock first to make it insecure.')` if locked. Race-safe across tabs. |
| `changeKeys` | `changeKeys(keys: Object)` | `Promise<void>` | Replaces the persisted `keys` map. No-op if the vault is currently insecure. Works in both locked and unlocked states. |
| `changeSettings` | `changeSettings(settings: Object)` | `Promise<void>` | Persists new settings and re-arms auto-lock. No-op if the vault is currently insecure. |
| `store` | `store(key: string, value: string \| Object)` | `void` | Writes to session storage immediately; persists to `localStorage` (encrypted if secure, plain if insecure). Objects are `JSON.stringify`'d for persistence. Throws if secure-and-locked. |
| `get` | `get(key: string)` | `string \| Object \| undefined` | Reads from session storage. Throws if secure-and-locked. |
| `remove` | `remove(key: string)` | `void` | Removes the key from both session storage and `localStorage`. Throws if secure-and-locked. |
| `hasKey` | `hasKey(key: string)` | `boolean` | True if a value exists in session storage for `key`. Throws if secure-and-locked. |
| `isEmpty` | `isEmpty()` | `boolean` | True if no `vault_data_*` entries exist in session storage. Throws if secure-and-locked. |
| `isSecure` | `isSecure()` | `boolean` | True when the session-storage `keys` map is non-empty. |
| `isLocked` | `isLocked()` | `boolean` | Always `false` for an insecure vault. Otherwise true when the in-memory private key or its session-storage broadcast is missing. |
| `destroy` | `destroy()` | `Promise<void>` | Removes every `localStorage` key starting with `vault`, clears session storage, drops the unlock key, emits `'destroy'`. |

Inherited from `EventEmitter` (`@dreamworld/event-emitter`):

| Method | Description |
|---|---|
| `on(event, handler)` | Subscribe to an event listed below. |
| `emit(event, …)` | Emit an event (used internally). |

Other `EventEmitter` methods are **Not determinable from provided source.**

##### Events

Emitted via `this.emit(...)` inside `vault.js`:

| Event | Payload | Emitted from |
|---|---|---|
| `unlock` | — | `unlock()` (`vault.js:174`), cross-tab sync in `_syncUnlockPrivateKey` (`vault.js:140`) |
| `lock` | — | `lock()` (`vault.js:383`), cross-tab sync in `_syncUnlockPrivateKey` (`vault.js:144`) |
| `secure` | — | `secure()` (`vault.js:283`) |
| `insecure` | — | `insecure()` (`vault.js:354`) |
| `destroy` | — | `destroy()` (`vault.js:451`) |

#### Module: `utils.js` (named exports)

| Function | Signature | Returns | Description |
|---|---|---|---|
| `getPrivateKeyFromPasscode` | `(authProvider: string, passcode: string, privateKeyByAuths: Object) => Promise<CryptoKey>` | AES-GCM `CryptoKey` (extractable, `encrypt`/`decrypt` usages) | Parses the base64url-encoded entry at `privateKeyByAuths[authProvider]`, derives an AES-GCM key from `passcode` via PBKDF2-SHA256 with the entry's `salt`/`iter`, AES-GCM-decrypts the embedded ciphertext to recover the raw 32-byte private key, and imports it. Throws if the entry is missing or `kdf !== "pbkdf2-sha256"`. |
| `encrypt` | `(key: CryptoKey, plaintext: string) => Promise<string>` | `"<base64-iv>$$<base64-ciphertext>"` | AES-GCM-encrypts `plaintext` under `key` with a fresh 12-byte IV. |
| `decrypt` | `(key: CryptoKey, payload: string) => Promise<string>` | Decoded plaintext string | Splits `"<iv>$$<ct>"`, base64-decodes both halves, AES-GCM-decrypts under `key`. |
| `getBase64PrivateKey` | `(key: CryptoKey) => Promise<string>` | base64 string | Exports `key` as raw bytes and base64-encodes them. |
| `privateKeyFromBase64` | `(b64Key: string) => Promise<CryptoKey>` | AES-GCM `CryptoKey` (non-extractable, `encrypt`/`decrypt`) | Reverse of `getBase64PrivateKey`. |

##### Encrypted-key-entry format consumed by `getPrivateKeyFromPasscode`

Each value of `privateKeyByAuths` is a base64url string. After base64url-decoding and JSON-parsing it must match:

```json
{
  "kdf": "pbkdf2-sha256",
  "params": { "salt": "<base64url>", "iter": <int>, "iv": "<base64url>" },
  "ct":     "<base64url>"
}
```

`ct` is the AES-GCM ciphertext of a raw 32-byte AES-256 private key, encrypted under the PBKDF2-derived key.

### Configuration Options

| Setting | Default | Source | Behavior |
|---|---|---|---|
| `autoLockTimeout` | `0` | `Vault.defaultSettings` | Minutes of user inactivity before the vault auto-locks. `0` disables auto-lock. Activity is detected on `mousedown`, `mousemove`, `keypress`, `scroll`, `touchstart`, `click` (capture-phase document listeners). |

Settings are merged on init in this precedence (`vault.js:96-100`): `Vault.defaultSettings` overrides persisted settings — i.e. `Vault.defaultSettings` wins on conflicting keys.

Internal cross-tab sync (`@dreamworld/session-storage`) uses `timeoutOnCloseTab: 10000` (10 s) — see `vault.js:69`.

Storage key layout written by the library:

| Key | Storage | Purpose |
|---|---|---|
| `vault_keys` | `localStorage` (JSON) | The `{ authProvider: encryptedKeyBlob }` map. |
| `vault_settings` | `localStorage` (JSON) | Persisted settings. |
| `vault_data_<key>` | `localStorage` | User-stored value (encrypted blob string when secure; plaintext when insecure). |
| `vault_keys`, `vault_settings`, `vault_initialized`, `vault_unlockPrivateKey`, `vault___activity__` | session-storage | In-memory mirror used for cross-tab sync. |
| `vault_data_<key>` | session-storage | Decrypted (or plaintext) live copy. |

### Advanced Usage

#### Cross-tab unlock/lock propagation

`_syncUnlockPrivateKey` (`vault.js:128`) subscribes to `@dreamworld/session-storage` change events. When another tab writes a new `vault_unlockPrivateKey`, this tab re-imports the key and emits `'unlock'`; when it's cleared, this tab drops its key and emits `'lock'`.

#### Auto-lock on inactivity

`_setupAutoLock` (`vault.js:526`) installs capture-phase document listeners for the six activity events listed above. Any activity resets a `setTimeout(autoLockTimeout × 60 × 1000)`. Activity is also broadcast via `vault___activity__` so other tabs reset their timers in sync.

#### Race-safe `insecure()`

`insecure()` snapshots `_unlockPrivateKey` locally before calling `_decryptAllData`, so a concurrent cross-tab clear that nulls `this._unlockPrivateKey` mid-call does not break decryption. If decryption fails *and* the vault has become insecure in the meantime, the call returns silently (`vault.js:339-347`).

#### Demo

A live demo lives at [demo/index.html](demo/index.html) with the wiring in [demo/demo.js](demo/demo.js). Run `npm run start` to serve it.

---

## 2. Developer Guide / Architecture

### Architecture Overview

- **Pattern: Observer / EventEmitter.** `Vault extends EventEmitter` (`vault.js:60`) and emits `unlock`, `lock`, `secure`, `insecure`, `destroy`. External consumers subscribe via `vault.on(event, handler)`.
- **Pattern: Two-tier storage.**
  - *Persistent tier* — `localStorage` holds `vault_keys`, `vault_settings`, and every `vault_data_<key>`. Values are AES-GCM ciphertext when secure, plaintext otherwise.
  - *In-memory / cross-tab tier* — `@dreamworld/session-storage` (constructed once per instance with `timeoutOnCloseTab: 10000`) holds the working copy of keys, settings, the broadcasted unlock private key, the initialization flag, and the decrypted data. A `subscribe` callback wires cross-tab unlock/lock and activity propagation.
- **Pattern: Lazy/idempotent initialization.** `_init` (`vault.js:87`) short-circuits when `vault_initialized` is already set in session storage, so multiple `new Vault()` instances in the same tab share one bootstrap.
- **Pattern: Strategy by mode.** `store`/`get`/`remove` branch on `isSecure()` to pick encrypted-vs-plain persistence. `_encryptAllData` and `_decryptAllData` are the bulk-mode transitions used by `secure()` / `insecure()`.
- **Crypto module separation.** `utils.js` is a pure functional module wrapping the Web Crypto API (`crypto.subtle`): PBKDF2-SHA256 (100k+ iter from the entry) → AES-GCM-256 unwrap of the stored private key → AES-GCM-256 for value encryption with a fresh 12-byte IV per `encrypt()` call. Ciphertext is serialized as `"<base64-iv>$$<base64-ct>"`.
- **Module responsibilities.**

  | File | Responsibility |
  |---|---|
  | [vault.js](vault.js) | Public `Vault` class, lifecycle (init/lock/unlock/secure/insecure/destroy), CRUD over the two-tier store, cross-tab sync, auto-lock. |
  | [utils.js](utils.js) | Web Crypto primitives: passcode→key derivation, AES-GCM encrypt/decrypt, key import/export to base64. |
  | [demo/](demo/) | Browser playground exercising every public method. |
  | [package.json](package.json) | Dependency manifest, `web-dev-server` scripts, `semantic-release` config. |
  | [.circleci/config.yml](.circleci/config.yml) | CI configuration (contents not summarized here). |

- **Threat model & non-goals.** `localStorage` is the persistence root; security depends entirely on the strength of the user's passcode and on `crypto.subtle`'s AES-GCM/PBKDF2 implementation. No protection is provided against same-origin XSS — anything that can run JS on the page can call `vault.get(...)` once unlocked.
