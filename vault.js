import EventEmitter from '@dreamworld/event-emitter/event-emitter.js';
import SessionStorage from '@dreamworld/session-storage';
import merge from 'lodash-es/merge.js';
import has from 'lodash-es/has.js';
import { getPrivateKeyFromPasscode, encrypt, decrypt, getBase64PrivateKey, privateKeyFromBase64 } from './utils.js';

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
 * - It first checks if session-storage has initialized data (`vault_initialized = true`).
 * - If it has, it means the vault is already initialized. No need to anything.
 * - If it doesn't have, it will initialize the vault from last persisted data.
 * - It loads keys and settings from persistent storage if available.
 * - If keys aren't available, it initializes with empty keys and default settings. (Insecure mode). 
 * - When keys are available, it initializes with the given keys and settings. (Secure mode).
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
  static prefix = 'vault';
  static dataPrefix = `${Vault.prefix}_data_`;
  static defaultSettings = {
    autoLockTimeout: 0 // 0 means no auto lock
  };
  
  constructor() {
    super();
    this._sessionStorage = new SessionStorage();

    this._autoLockTimer = null;
    this._activityListeners = [];

    this._unlockPrivateKey = null;
    this._init();
    this._setupAutoLock();
  }

  /**
   * It initializes the vault data.
   * If session storage has initialized data (`vault_initialized = true`), it means the vault is already initialized. No need to anything.
   * If session storage doesn't have initialized data, it will initialize the vault from last persisted data.
   * It loads keys and settings from persistent storage if available.
   * If keys and settings aren't available, it initialize with empty keys and default settings.
   * It stores keys and settings into session storage.
   */
  _init() {
    // Check if already initialized in this session
    if (this._sessionStorage.get(this._getKey('initialized'))) {
      this._syncUnlockPrivateKey();
      return;
    }

    // Load keys and settings from persistent storage
    const keys = this._getPersistedKeys();
    const settings = merge(
      {},
      this._getPersistedSettings(),
      Vault.defaultSettings
    );

    // Store keys and settings in session storage for cross-tab access
    this._sessionStorage.set(this._getKey('keys'), keys);
    this._sessionStorage.set(this._getKey('settings'), settings);

    this._loadPlainDataToSession();

    // Set unlock state from session storage if available
    this._syncUnlockPrivateKey();

    // Mark as initialized
    this._sessionStorage.set(this._getKey('initialized'), true);
  }

  _setUnlockKey(b64key) {
    if (b64key) {
      this._unlockPrivateKey = true;
      privateKeyFromBase64(b64key).then(key => {
        this._unlockPrivateKey = key;
      });
    }
  }

  /**
   * It sets the `_unlockPrivateKey` from session storage if available.
   * And also listens to session storage changes to set the `_unlockPrivateKey` when changed in other tabs.
   */
  _syncUnlockPrivateKey() {
    const key = this._sessionStorage.get(this._getKey('unlockPrivateKey'));
    this._setUnlockKey(key);

    this._sessionStorage.subscribe((changes) => {
      if (!has(changes, this._getKey('unlockPrivateKey'))) {
        return;
      }

      const key = this._sessionStorage.get(this._getKey('unlockPrivateKey'));
      if (key && !this._unlockPrivateKey) {
        this._setUnlockKey(key);
        this.emit('unlock');
        this._setupAutoLock();
      } else if (!key && this._unlockPrivateKey) {
        this._unlockPrivateKey = null;
        this.emit('lock');
      }
    });
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
      // Use cached keys for better performance
      const keys = this._sessionStorage.get(this._getKey('keys'));
      if (!keys || Object.keys(keys).length === 0) {
        throw new Error('Vault is not secure');
      }

      this._unlockPrivateKey = await getPrivateKeyFromPasscode(keyName, passcode, keys);

      await this._loadDataToSession();
      
      // Store unlock state for cross-tab sync
      const b64UnlockedKey = await getBase64PrivateKey(this._unlockPrivateKey);
      this._sessionStorage.set(this._getKey('unlockPrivateKey'), b64UnlockedKey);

      // Dispatch `unlock` event
      this.emit('unlock');
      this._setupAutoLock();
      return true;
    } catch (error) {
      console.warn('Failed to unlock vault:', error);
      return false;
    }
  }

  _getDataKey(key) {
    return `${Vault.dataPrefix + key}`;
  }

  _getKey(key) {
    return `${Vault.prefix}_${key}`;
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

    key = this._getDataKey(key);

    // Store in session for immediate access
    this._sessionStorage.set(key, value);
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (this.isSecure()) {
      // Encrypt and store in persistent storage
      this._encryptAndStore(key, stringValue);
    } else {
      // Store directly in localStorage for insecure mode
      localStorage.setItem(key, stringValue);
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
    const value = this._sessionStorage.get(this._getDataKey(key));
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

    key = this._getDataKey(key);
    this._sessionStorage.remove(key);
    localStorage.removeItem(key);
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
    this._unlockPrivateKey = await getPrivateKeyFromPasscode(keyName, passcode, keys);

    // Encrypt all existing data
    await this._encryptAllData();

    // Store keys
    this._persistKeys(keys);
    this._sessionStorage.set(this._getKey('keys'), keys);

    // Store unlock state for cross-tab sync
    const b64UnlockedKey = await getBase64PrivateKey(this._unlockPrivateKey);
    this._sessionStorage.set(this._getKey('unlockPrivateKey'), b64UnlockedKey);

    this.emit('secure');
    this._setupAutoLock();
  }

  /**
   * It changes the keys of the vault with the given keys.
   * It works in both locked and unlocked states.
   * @param {Object} keys 
   */
  async changeKeys(keys) {
    if (!this.isSecure()) {
      return;
    }

    this._persistKeys(keys);
    this._sessionStorage.set(this._getKey('keys'), keys);
  }

  /**
   * It changes the settings of the vault with the given.
   * It works in both locked and unlocked states.
   * @param {Object} settings 
   */
  async changeSettings(settings) {
    if (!this.isSecure()) {
      return;
    }

    this._persistSettings(settings);
    this._sessionStorage.set(this._getKey('settings'), settings);
    this._setupAutoLock();
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
    localStorage.removeItem(this._getKey('keys'));
    this._sessionStorage.remove(this._getKey('keys'));
    this._unlockPrivateKey = null;
    this._sessionStorage.remove(this._getKey('unlockPrivateKey'));
    this.emit('insecure');
    this._clearAutoLockTimer();
    this._removeActivityListeners();
  }

  _clearSessionData() {
    const sessionData = this._sessionStorage.getAll();
    const keys = Object.keys(sessionData).filter(key => 
      key.startsWith(Vault.dataPrefix)
    );

    for (const key of keys) {
      this._sessionStorage.remove(key);
    }
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

    this._clearSessionData();
    this._unlockPrivateKey = null;
    this._sessionStorage.remove(this._getKey('unlockPrivateKey'));
    this.emit('lock');
    this._clearAutoLockTimer();
    this._removeActivityListeners();
  }

  /**
   * It checks if the vault is secure (has keys).
   */
  isSecure() {
    const keys = this._sessionStorage.get(this._getKey('keys'));
    return keys && Object.keys(keys).length > 0;
  }

  /**
   * It checks if the vault is locked.
   */
  isLocked() {
    if (!this.isSecure()) {
      return false; // Insecure vault cannot be locked
    }

    return !this._unlockPrivateKey || !this._sessionStorage.get(this._getKey('unlockPrivateKey'));
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

    return !!this._sessionStorage.get(this._getDataKey(key));
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

    return Object.keys(this._getDataFromSession()).length === 0;
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
    this._sessionStorage.clear();
    
    // Reset state
    this._unlockPrivateKey = null;
    
    this.emit('destroy');
  }

  // Private methods
  _getPersistedKeys() {
    try {
      const keys = localStorage.getItem(this._getKey('keys'));
      return keys ? JSON.parse(keys) : null;
    } catch (error) {
      console.warn(`Failed to parse persisted keys: ${error.message}`);
      return {};
    }
  }

  _persistKeys(keys) {
    if (keys && Object.keys(keys).length > 0) {
      localStorage.setItem(this._getKey('keys'), JSON.stringify(keys));
    } else {
      localStorage.setItem(this._getKey('keys'), {});
    }
  }

  _getPersistedSettings() {
    try {
      const settings = localStorage.getItem(this._getKey('settings'));
      return settings ? JSON.parse(settings) : {};
    } catch (error) {
      console.warn(`Failed to parse persisted settings: ${error.message}`);
      return {};
    }
  }

  _persistSettings(settings) {
    localStorage.setItem(this._getKey('settings'), JSON.stringify(settings));
  }

  _loadPlainDataToSession() {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(Vault.dataPrefix)
    );

    for (const storageKey of keys) {
      let data = localStorage.getItem(storageKey);

      try {
        data = JSON.parse(data);
      } catch (error) {
        // ignore
      }
      
      this._sessionStorage.set(storageKey, data);
    }
  }

  async _loadDataToSession() {
    if (!this._unlockPrivateKey) {
      return;
    }

    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(Vault.dataPrefix)
    );

    for (const storageKey of keys) {
      const dataKey = storageKey.replace(`${Vault.dataPrefix}`, '');
      try {
        const encryptedData = JSON.parse(localStorage.getItem(storageKey));
        const decrypted = await decrypt(this._unlockPrivateKey, encryptedData);
        this._sessionStorage.set(storageKey, decrypted);
      } catch (error) {
        console.error(`Failed to decrypt data for key ${dataKey}:`, error);
      }
    }
  }

  _setupAutoLock() {
    const settings = this._sessionStorage.get(this._getKey('settings'));
    if (!this.isSecure() || this.isLocked()) {
      return;
    }

    this._clearAutoLockTimer();

    if (!settings?.autoLockTimeout || settings.autoLockTimeout <= 0) {
      return;
    }

    const setupTimer = () => {
      this._clearAutoLockTimer();
      this._autoLockTimer = setTimeout(() => {
        if (!this.isLocked()) {
          this.lock();
        }
      }, settings.autoLockTimeout * 60 * 1000);
    };

    // Set up activity listeners
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const resetTimer = () => {
      this._sessionStorage.set(this._getKey('__activity__'), Date.now());
      setupTimer();
    };

    // Remove existing listeners
    this._removeActivityListeners();

    // Add new listeners
    activities.forEach(activity => {
      document.addEventListener(activity, resetTimer, true);
      this._activityListeners.push({ event: activity, handler: resetTimer });
    });

    this._sessionStorage.subscribe((changes) => {
      if (!has(changes, this._getKey('__activity__'))) {
        return;
      }

      setupTimer();
    });

    setupTimer();
  }

  _clearAutoLockTimer() {
    if (this._autoLockTimer) {
      clearTimeout(this._autoLockTimer);
      this._autoLockTimer = null;
    }
  }

  _removeActivityListeners() {
    this._activityListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler, true);
    });
    this._activityListeners = [];
  }

  _getDataFromSession() {
    const data = {};
    const sessionData = this._sessionStorage.getAll();
    const keys = Object.keys(sessionData).filter(key => 
      key.startsWith(Vault.dataPrefix)
    );

    for (const key of keys) {
      const dataKey = key.replace(Vault.dataPrefix, '');
      data[dataKey] = sessionData[key];
    }

    return data;
  }

  async _encryptAllData() {
    if (!this._unlockPrivateKey) {
      return;
    }

    // Get all data from session
    const allData = this._getDataFromSession();

    // Encrypt and store each item
    for (const [key, value] of Object.entries(allData)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this._encryptAndStore(this._getDataKey(key), stringValue);
    }
  }

  async _encryptAndStore(key, value) {
    if (!this._unlockPrivateKey) {
      throw new Error('No private key available for encryption');
    }

    try {
      const encrypted = await encrypt(this._unlockPrivateKey, value);
      localStorage.setItem(key, JSON.stringify(encrypted));
    } catch (error) {
      console.error('Failed to encrypt and store data:', error);
      throw error;
    }
  }

  _getAllPlainData() {
    const data = {};
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(Vault.dataPrefix)
    );

    for (const storageKey of keys) {
      const dataKey = storageKey.replace(Vault.dataPrefix, '');
      data[dataKey] = localStorage.getItem(storageKey);
    }

    return data;
  }

  _clearPlainData() {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(Vault.dataPrefix)
    );

    keys.forEach(key => localStorage.removeItem(key));
  }

  async _decryptAllData() {
    if (!this._unlockPrivateKey) {
      throw new Error('Vault must be unlocked to decrypt data');
    }

    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(Vault.dataPrefix)
    );

    for (const storageKey of keys) {
      const dataKey = storageKey.replace(Vault.dataPrefix, '');
      try {
        const encryptedData = JSON.parse(localStorage.getItem(storageKey));
        const decrypted = await decrypt(this._unlockPrivateKey, encryptedData);
        
        // Store as plain text
        localStorage.setItem(this._getDataKey(dataKey), decrypted);
      } catch (error) {
        console.error(`Failed to decrypt data for key ${dataKey}:`, error);
      }
    }
  }

  _clearAllPersistedData() {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(Vault.prefix)
    );
    keys.forEach(key => localStorage.removeItem(key));
  }
}