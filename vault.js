import EventEmitter from 'eventemitter3';
import SessionStorage from '@dreamworld/session-storage';
import { getPrivateKeyFromPasscode, encrypt, decrypt } from './utils.js';

/**
 * 
 * Storage:
 * - Persistent storage (localStorage):
 *  - Used to store keys, settings, and encrypted/plain text values.
 * - In-memory storage (SessionStorage via `@dreamworld/session-storage`):
 *  - It is used to sync in-memory data across multiple tabs.
 *  - Used to store decrypted values when vault is unlocked.
 *  - Used to sync unlock state across tabs.
 * 
 * Initialization:
 * - If keys aren't passed, it initializes with empty keys and default settings. (Insecure mode). 
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
  
  constructor() {
    super();
    this.storagePrefix = 'vault';
    this.sessionStorage = new SessionStorage('vault_session');
    this.currentPrivateKey = null;
    this.autoLockTimer = null;
    this.activityListeners = [];
    this.defaultSettings = {
      autoLockTimeout: 0 // 0 means no auto lock
    };
  }

  /**
   * It loads the vault from persistent storage.
   * It returns a Vault instance.
   * If the vault was previously unlocked (cross-tab sync), it restores the private key and loads decrypted data to session storage.
   * It it's not possible to load (e.g: no persisted keys or corrupted data), it throws an error.
   * @returns {Promise<Vault>}
   */
  static async load() {
    const vault = new Vault();
    
    // Load persisted data - this will throw if data is not available or corrupted
    const persistedKeys = vault._getPersistedKeys();
    const persistedSettings = vault._getPersistedSettings();
    
    if (!persistedKeys) {
      throw new Error('Vault load failed: No persistent keys found.');
    }
    
    if (Object.keys(persistedKeys).length === 0) {
      throw new Error('Vault load failed: Persistent keys are empty.');
    }
    
    vault.settings = persistedSettings || vault.defaultSettings;
    
    // Check if vault was previously unlocked (cross-tab sync)
    const unlockState = vault.sessionStorage.get('unlockState');
    if (unlockState) {
      // Vault is unlocked, restore private key and load data
      vault.currentPrivateKey = unlockState.privateKey;
      await vault._loadDataToSession();
    }
    
    vault._setupAutoLock();
    return vault;
  }

  /**
   * It initializes the vault with the given keys and settings.
   * It persists keys and settings in localStorage for future initializations.
   * If parameters isn't passed, it initializes with empty keys and default settings.
   * If initialized with keys, it would be intialized with secure mode.
   * If initialized without keys, it would be in insecure mode.
   * If initialized with secure mode, it would be unlocked if session storage has unlock details, otherwise locked.
   * @param {Object} { keys, settings } 
   * - keys: { $authProvider: $privateKey }, 
   *    - $authProvider: String (e.g: 'password', 'biometric:$deviceId' etc.)
   *    - $privateKey: String (a 256-bit Key encrypted using passcode and encoded as Base64)
   * - settings: { autoLockTimeout: Number (in ms) }
   * @returns {Promise<Vault>}
   */
  static async initialize({ keys, settings } = {}) {
    const vault = new Vault();

    // Set defaults if not provided
    keys = keys || {};
    settings = { ...vault.defaultSettings, ...settings };

    // Persist keys and settings
    vault._persistKeys(keys);
    vault._persistSettings(settings);
    vault.settings = settings;
    

    // Check if vault was previously unlocked (cross-tab sync)
    const unlockState = vault.sessionStorage.get('unlockState');
    if (unlockState && Object.keys(keys).length > 0) {
      // Vault is unlocked, restore private key
      vault.currentPrivateKey = unlockState.privateKey;
      await vault._loadDataToSession();
    }

    vault._setupAutoLock();
    return vault;
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
    try {
      const keys = this._getPersistedKeys();
      if (!keys || Object.keys(keys).length === 0) {
        throw new Error('Vault is not secure');
      }

      this.currentPrivateKey = await getPrivateKeyFromPasscode(keyName, passcode, keys);
      
      // Store unlock state for cross-tab sync
      this.sessionStorage.set('unlockState', { 
        privateKey: this.currentPrivateKey,
        keyName,
        timestamp: Date.now()
      });

      await this._loadDataToSession();
      this._setupAutoLock();
      this.emit('unlock');
      return true;
    } catch (error) {
      console.error('Failed to unlock vault:', error);
      return false;
    }
  }

  /**
   * It stores the given value against the given key.
   * It will store given data in session storage as well as in persistent storage.
   * If the vault is secure, it will store the encrypted data  in persistent storage.
   * If the vault is insecure, it will store the data in plain text in persistent storage.
   * If the vault is locked, it will throw an error.
   * @param {String} key 
   * @param {String | Object} value 
   * @throws {Error} if the vault is locked.
   */
  store(key, value) {
    if (this.isSecure() && this.isLocked()) {
      throw new Error('Vault is locked. Unlock first to store data.');
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    // Store in session for immediate access
    this.sessionStorage.set(key, stringValue);
    
    if (this.isSecure()) {
      // Encrypt and store in persistent storage
      this._encryptAndStore(key, stringValue);
    } else {
      // Store directly in localStorage for insecure mode
      localStorage.setItem(`${this.storagePrefix}_data_${key}`, stringValue);
    }
  }

  /**
   * It retrieves the value stored against the given key.
   * It will retrieve data from session storage.
   * If the vault is locked, it will throw an error.
   * @param {String} key 
   * @return {String | Object} value
   * @throws {Error} if the vault is locked.
   */
  get(key) {
    if (this.isSecure() && this.isLocked()) {
      throw new Error('Vault is locked. Unlock first to access data.');
    }

    // Get from session storage
    const value = this.sessionStorage.get(key);
    return value;
  }

  /**
   * It removes the value stored against the given key.
   * It will remove data from both session storage and persistent storage.
   * If the vault is locked, it will throw an error.
   * @param {String} key 
   * @throws {Error} if the vault is locked.
   */
  remove(key) {
    if (this.isSecure() && this.isLocked()) {
      throw new Error('Vault is locked. Unlock first to remove data.');
    }

    this.sessionStorage.remove(key);
    localStorage.removeItem(`${this.storagePrefix}_data_${key}`);
  }

  /**
   * It secures the vault with the given keys, keyName and passcode.
   * It dispatches 'secure' event on itself; when the vault is made secure.
   * It encrypts all stored values and store in persistent storage.
   * @param {Object} keys { $authProvider: $privateKey }
   * @param {String} keyName 
   * @param {String} passcode 
   */
  async secure(keys, keyName, passcode) {
    if (this.isSecure()) {
      throw new Error('Vault is already secure');
    }

    // Get current private key for encryption by decrypting with passcode
    this.currentPrivateKey = await getPrivateKeyFromPasscode(keyName, passcode, keys);
    
    // Encrypt all existing data
    await this._encryptAllData();
    
    // Persist keys
    this._persistKeys(keys);
    
    // Set unlock state for cross-tab sync
    this.sessionStorage.set('unlockState', {
      privateKey: this.currentPrivateKey,
      keyName,
      timestamp: Date.now()
    });

    this._setupAutoLock();
    this.emit('secure');
  }

  /**
   * It changes the keys of the vault with the given keys.
   * It works in both locked and unlocked states.
   * @param {Object} keys 
   */
  async changeKeys(keys) {
    const noOfKeys = Object.keys(keys).length;

    // Currently, insecure mode and new keys are provided.
    if (!isSecure() && noOfKeys > 0) {
      return;
    }

    if (isSecure() && noOfKeys === 0) {
      return;
    }

    // Persist keys
    this._persistKeys(keys);
  }

  /**
   * It makes the vault insecure (removes all keys).
   * All encrypted stored values are decrypted and stored in plain text in persistent storage.
   * It dispatches 'insecure' event on itself; when the vault is made insecure.
   */
  async insecure() {
    if (this.isLocked()) {
      throw new Error('Vault is locked. Unlock first to make it insecure.');
    }

    // Decrypt all data and store as plain text
    await this._decryptAllData();
    
    // Remove keys
    localStorage.removeItem(`${this.storagePrefix}_keys`);
    this.currentPrivateKey = null;
    this.sessionStorage.remove('unlockState');
    
    this._clearAutoLockTimer();
    this.emit('insecure');
  }

  /**
   * It locks the vault.
   * All data in session storage will be cleared.
   * It dispatches 'lock' event on itself; when the vault is locked.
   */
  async lock() {
    if (!this.isSecure()) {
      throw new Error('Cannot lock an insecure vault');
    }

    this.sessionStorage.clear();
    this.currentPrivateKey = null;
    this.sessionStorage.remove('unlockState');
    this._clearAutoLockTimer();
    this._removeActivityListeners();
    this.emit('lock');
  }

  /**
   * It checks if the vault is secure (has keys).
   */
  isSecure() {
    const keys = this._getPersistedKeys();
    return keys && Object.keys(keys).length > 0;
  }

  /**
   * It checks if the vault is locked.
   */
  isLocked() {
    if (!this.isSecure()) {
      return false; // Insecure vault cannot be locked
    }
    return !this.currentPrivateKey || !this.sessionStorage.get('unlockState');
  }

  /**
   * It checks if the vault has the given key.
   * It can't be used when the vault is locked.
   * If the vault is locked, it will throw an error.
   * @param {String} key 
   */
  hasKey(key) {
    if (this.isSecure() && this.isLocked()) {
      throw new Error('Vault is locked. Unlock first to check keys.');
    }

    return !!this.sessionStorage.get(key);
  }

  /**
   * It checks if the vault is empty (has no stored values).
   * It can't be used when the vault is locked.
   * If the vault is locked, it will throw an error.
   */
  isEmpty() {
    if (this.isSecure() && this.isLocked()) {
      throw new Error('Vault is locked. Unlock first to check if empty.');
    }

    return Object.keys(this.sessionStorage.getAll()).length === 0;
  }

  /**
   * It destroys the vault, removing all keys and stored values.
   * It clears all data from both persistent storage and session storage.
   * After calling this method, the vault needs to be initialized again before use.
   * It dispatches 'destroy' event on itself; when the vault is destroyed.
   * @return {Promise<void>}
   */
  async destroy() {
    // Clear all persistent data
    this._clearAllPersistedData();
    
    // Clear session data
    this.sessionStorage.clear();
    
    // Reset state
    this.currentPrivateKey = null;
    this._clearAutoLockTimer();
    this._removeActivityListeners();
    
    this.emit('destroy');
  }

  // Private methods
  _getPersistedKeys() {
    try {
      const keys = localStorage.getItem(`${this.storagePrefix}_keys`);
      return keys ? JSON.parse(keys) : null;
    } catch (error) {
      throw new Error(`Vault load failed: Unable to parse persistent keys. Data may be corrupted. Error: ${error.message}`);
    }
  }

  _persistKeys(keys) {
    if (keys && Object.keys(keys).length > 0) {
      localStorage.setItem(`${this.storagePrefix}_keys`, JSON.stringify(keys));
    } else {
      localStorage.removeItem(`${this.storagePrefix}_keys`);
    }
  }

  _getPersistedSettings() {
    try {
      const settings = localStorage.getItem(`${this.storagePrefix}_settings`);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      throw new Error(`Vault load failed: Unable to parse persistent settings. Data may be corrupted. Error: ${error.message}`);
    }
  }

  _persistSettings(settings) {
    localStorage.setItem(`${this.storagePrefix}_settings`, JSON.stringify(settings));
  }

  async _loadDataToSession() {
    if (!this.currentPrivateKey) {
      return;
    }

    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`${this.storagePrefix}_data_`)
    );

    for (const storageKey of keys) {
      const dataKey = storageKey.replace(`${this.storagePrefix}_data_`, '');
      try {
        const encryptedData = JSON.parse(localStorage.getItem(storageKey));
        const decrypted = await decrypt(this.currentPrivateKey, encryptedData);
        this.sessionStorage.set(dataKey, decrypted);
      } catch (error) {
        console.error(`Failed to decrypt data for key ${dataKey}:`, error);
      }
    }
  }

  _setupAutoLock() {
    if (!this.currentPrivateKey) {
      return;
    }

    this._clearAutoLockTimer();
    
    if (!this.settings?.autoLockTimeout || this.settings.autoLockTimeout <= 0) {
      return;
    }

    const setupTimer = () => {
      this._clearAutoLockTimer();
      this.autoLockTimer = setTimeout(() => {
        if (!this.isLocked()) {
          this.lock();
        }
      }, this.settings.autoLockTimeout);
    };

    // Set up activity listeners
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const resetTimer = () => setupTimer();

    // Remove existing listeners
    this._removeActivityListeners();

    // Add new listeners
    activities.forEach(activity => {
      document.addEventListener(activity, resetTimer, true);
      this.activityListeners.push({ event: activity, handler: resetTimer });
    });

    setupTimer();
  }

  _clearAutoLockTimer() {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  _removeActivityListeners() {
    this.activityListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler, true);
    });
    this.activityListeners = [];
  }

  async _encryptAllData() {
    if (!this.currentPrivateKey) {
      return;
    }

    // Get all data from session or localStorage (for insecure mode)
    const allData = this.isSecure() ? this.sessionStorage.getAll() : this._getAllPlainData();

    // Encrypt and store each item
    for (const [key, value] of Object.entries(allData)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this._encryptAndStore(key, stringValue);
    }

    // Remove plain text data if transitioning from insecure
    if (!this.isSecure()) {
      this._clearPlainData();
    }
  }

  async _encryptAndStore(key, value) {
    if (!this.currentPrivateKey) {
      throw new Error('No private key available for encryption');
    }

    try {
      const encrypted = await encrypt(this.currentPrivateKey, value);
      localStorage.setItem(`${this.storagePrefix}_data_${key}`, JSON.stringify(encrypted));
    } catch (error) {
      console.error('Failed to encrypt and store data:', error);
      throw error;
    }
  }

  _getAllPlainData() {
    const data = {};
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`${this.storagePrefix}_data_`)
    );

    for (const storageKey of keys) {
      const dataKey = storageKey.replace(`${this.storagePrefix}_data_`, '');
      data[dataKey] = localStorage.getItem(storageKey);
    }

    return data;
  }

  _clearPlainData() {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`${this.storagePrefix}_data_`)
    );

    keys.forEach(key => localStorage.removeItem(key));
  }

  async _decryptAllData() {
    if (!this.currentPrivateKey) {
      throw new Error('Vault must be unlocked to decrypt data');
    }

    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`${this.storagePrefix}_data_`)
    );

    for (const storageKey of keys) {
      const dataKey = storageKey.replace(`${this.storagePrefix}_data_`, '');
      try {
        const encryptedData = JSON.parse(localStorage.getItem(storageKey));
        const decrypted = await decrypt(this.currentPrivateKey, encryptedData);
        
        // Store as plain text
        localStorage.setItem(`${this.storagePrefix}_data_${dataKey}`, decrypted);
      } catch (error) {
        console.error(`Failed to decrypt data for key ${dataKey}:`, error);
      }
    }
  }

  _clearAllPersistedData() {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(this.storagePrefix)
    );
    keys.forEach(key => localStorage.removeItem(key));
  }
}