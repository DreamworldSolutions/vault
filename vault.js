
/**
 * Vault class to securely store and manage sensitive data.
 * It supports locking, unlocking, securing, and changing keys.
 * It emits events on state changes: 'unlock', 'secure', 'insecure', 'lock', 'destroy'.
 * 
 * How it works:
 * - The vault can be initialized with keys and settings.
 * - It can be locked and unlocked using a keyName and passcode.
 * - When unlocked, it can store, retrieve, and remove key-value pairs.
 * - It can be secured with new keys and changing keys.
 * - It can be made insecure by removing all keys.
 * - It can check its state (secure, locked, empty) and presence of specific keys.
 * - It can be destroyed, removing all data and requiring re-initialization.
 * 
 * How it stores data securely:
 * - It uses localStorage for persistent storage.
 * - It stores keys and settings in persistent storage for re-initialization.
 * - If vault is secured then all stored values are encrypted.
 * - If vault is insecure then all stored values are in plain text.
 * - It uses `@dreamworld/session-storage` to store data in session storage when unlocked.
 * - When locked, all data in session storage is cleared.
 */
export default class Vault extends EventEmitter {

  /**
   * It initializes the vault with the given keys and settings.
   * When no arguments are passed, initialized based on the last persisted keys & settings. If none, it initializes with empty keys & default settings.
   * It persists keys & settings are stored in persistent storage.
   * @param {Object} { keys, settings } 
   * - keys: { $authProvider: $privateKey }, 
   *    - $authProvider: String (e.g: 'password', 'biometric:$deviceId' etc.)
   *    - $privateKey: String (a 256-bit Key encrypted using passcode and encoded as Base64)
   * - settings: { autoLockTimeout: Number (in ms) }
   * @returns {Promise<void>}
   */
  static async initialize({ keys, settings }) {

  }

  /**
   * It unlocks the vault with the given keyName and passcode.
   * It dispatches 'unlock' event on itself; when the vault is unlocked.
   * It decrypts all stored values and store in session storage.
   * @param {String} keyName 
   * @param {String} passcode 
   * @returns {Promise<Boolean>} - true if unlocked successfully, false otherwise.
   */
  async unlock(keyName, passcode) {

  }

  /**
   * It stores the given value against the given key.
   * @param {String} key 
   * @param {String | Object} value 
   */
  store(key, value) {

  }

  /**
   * It retrieves the value stored against the given key.
   * @param {String} key 
   */
  get(key) {

  }

  /**
   * It removes the value stored against the given key.
   * @param {String} key 
   */
  remove(key) {

  }

  /**
   * It secures the vault with the given keys, keyName and passcode.
   * It dispatches 'secure' event on itself; when the vault is made secure.
   * It encrypts all stored values and store in persistent storage.
   * @param {Object} keys { $authProvider: $privateKey }
   * @param {String} keyName 
   * @param {String} passcode 
   */
  async secure(keys, keyName, passscode) {

  }

  /**
   * It changes the keys of the vault with the given keys.
   * It works in both locked and unlocked states.
   * @param {Object} keys 
   */
  async changeKeys(keys) {

  }

  /**
   * It makes the vault insecure (removes all keys).
   * All encrypted stored values are decrypted and stored in plain text in persistent storage.
   * It dispatches 'insecure' event on itself; when the vault is made insecure.
   */
  async insecure() {

  }

  /**
   * It locks the vault.
   * All data in session storage will be cleared.
   * It dispatches 'lock' event on itself; when the vault is locked.
   */
  async lock() {

  }

  /**
   * It checks if the vault is secure (has keys).
   */
  isSecure() {

  }

  /**
   * It checks if the vault is locked.
   */
  isLocked() {

  }

  /**
   * It checks if the vault has the given key.
   * @param {String} key 
   */
  hasKey(key) {

  }

  /**
   * It checks if the vault is empty (has no stored values).
   */
  isEmpty() {

  }

  /**
   * It destroys the vault, removing all keys and stored values.
   * It clears all data from both persistent storage and session storage.
   * After calling this method, the vault needs to be initialized again before use.
   * It dispatches 'destroy' event on itself; when the vault is destroyed.
   * @return {Promise<void>}
   */
  async destroy() {

  }
}