
/**
 * 
 * Storage:
 * - Persistent storage (localStorage):
 *  - Used to store keys, settings, and encrypted/plain text values.
 * - In-memory storage (SessionStorage via `@dreamworld/session-storage`):
 *  - Used to store decrypted values when vault is unlocked.
 *  - Used to sync unlock state across tabs.
 * 
 * Initialization:
 * - When no arguments are passed, initialized based on the last persisted keys & settings. It there are no persisted 
 * keys, it fails to initialize.
 * - If empty keys are passed, it initializes with empty keys and default settings. (Insecure mode). 
 * - When keys are passed, it initializes with the given keys and settings. (Secure mode).
 * - Settings are optional, if not passed, default settings are used.
 * 
 * Auto lock/unlock on initialization:
 * - If session-storage has unlock details, it means the vault is unlocked.
 * - If it doesn't have, it will be locked.
 * 
 * Lock:
 * - It clears all data in session storage.
 * 
 * Unlock:
 * - It decrypts all stored values and store in session storage.
 * 
 * Secure:
 * - It encrypts all stored values.
 * - How encryption works:
 *  - It decrypts privateKey using the given passcode of the given keyName(authProvider).
 *  - It encrypts all stored values using the decrypted privateKey.
 * 
 * Insecure:
 * - It must be called when the vault is unlocked.
 * - It removes all keys.
 * - it decrypts all stored values and store in plain text in persistent storage.
 * 
 * Auto lock on inactivity:
 * - It auto locks the vault if it is unlocked and there is no activity for the given `Settings.autoLockTimeout` period.
 * - Default is 0 (no auto lock).
 * - Activity means mouse move, key press, touch etc.
 * 
 * Events:
 * - 'unlock': Dispatched when the vault is unlocked.
 * - 'secure': Dispatched when the vault is made secure.
 * - 'insecure': Dispatched when the vault is made insecure.
 * - 'lock': Dispatched when the vault is locked.
 * - 'destroy': Dispatched when the vault is destroyed.
 */
export default class Vault extends EventEmitter {

  /**
   * It initializes the vault with the given keys and settings.
   * When no arguments are passed, initialized based on the last persisted keys & settings. 
   * If none, it initializes with empty keys & default settings.
   * It persists keys & settings in localStorage.
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