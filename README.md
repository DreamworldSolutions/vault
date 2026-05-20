# Vault

## Overview

**Vault** is a secure data storage library that provides encrypted storage capabilities for web applications. It allows developers to integrate secure data management into their applications with support for both secure and insecure storage modes.

### Key Features

- **Secure Storage**: Encrypt sensitive data using industry-standard encryption algorithms
- **Insecure Storage**: Optional plain storage for non-sensitive data with better performance
- **Lock/Unlock Mechanism**: Control access to secure data with password-based locking
- **Access Control**: Prevent data access when vault is in locked state
- **Persistent Storage**: Data persists across browser sessions using localStorage/sessionStorage
- **Easy Integration**: Simple API for seamless integration into existing applications
- **Performance Optimized**: Efficient encryption/decryption with minimal overhead

### Storage Modes

#### Secure Mode
- Data is encrypted using AES-256 encryption
- Requires password/key to unlock vault
- All data access is blocked when vault is locked
- Suitable for sensitive information like API keys, tokens, personal data

#### Insecure Mode  
- Data stored in plain text format
- No encryption overhead for better performance
- Immediate access without unlocking
- Suitable for application settings, preferences, cache data

### Security Features

- **AES-256 Encryption**: Military-grade encryption for maximum security
- **Memory Protection**: Sensitive data cleared from memory after use
- **Automatic Locking**: Configurable auto-lock timeout for enhanced security

### Use Cases

- **API Key Management**: Securely store API keys and authentication tokens
- **User Credentials**: Encrypt sensitive user information and passwords
- **Application Settings**: Store both secure and non-secure configuration data
- **Session Data**: Manage encrypted session information
- **Personal Data**: Protect user's personal and financial information
- **Development Tools**: Secure storage for development credentials and secrets
- **App Lock feature**: Implement app lock feature using it.

## Usage pattern

### Import and Initialize
```javascript
import Vault from '@dreamworld/vault';

//Initialize with keys and settings
const vault = Vault.initialize({ keys, settings });

//Initialize with insecure mode
const vault = Vault.initialize({});

//Initialize from last persisted state
const vault = Vault.initialize();
```

### Change keys
```javascript
await vault.changeKeys(keys); //It will be work in both states whether vault is locked or unlocked
```

### Make it secure/insecure
```javascript
//Make it secure by providing keys
await vault.secure(keys, keyName, passcode);

//Make secure vault to insecure
await vault.insecure();

//Check whether vault is secure or not
vault.isSecure();
```

### Lock/Unlock vault (When vault is secure)
```javascript
//Unlock the vault
await vault.unlock(keyName, passcode);

//Lock the vault explicitly
await vault.lock();

//Check whether vault is locked or not
vault.isLocked();
```

### Use vault to store custom values
```javascript
//Store key and value
vault.store(key, value);

//Get stored value by key
vault.get(key);

//Remove stored value by key
vault.remove(key);

//Check whether value is stored with given key or not
vault.hasKey(key);

//Check for empty
vault.isEmpty();
```

### Destory
```javascript
//Destory all stored values
await vault.destroy();
```

### Bind events
```javascript
vault.on('lock', () => {});
vault.on('unlock', () => {});
vault.on('secure', () => {});
vault.on('insecure', () => {});
vault.on('destroy', () => {});
```

## Architecture
- It uses localStorage as persistence storage and `@dreamworld/session-storage` as in-memory storage.
- When vault is secure, it stores encrypted data into persistent storage.
- When vault is insecure, it stores data as plain text.
- It uses `eventemitter3` for events. (https://www.npmjs.com/package/eventemitter3)
- When vault is locked, it clears in-memory storage. And on unlock, it populates data into session-storage from the persistent storage.

