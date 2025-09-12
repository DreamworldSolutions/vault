import Vault from '../vault.js';

// Global vault instance
window.vault = new Vault();

console.log("demo.js loaded");
// Logging functionality
function log(message, type = 'info') {
    const logElement = document.getElementById('event-log');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}\n`;
    logElement.textContent += '\n'+ logEntry;
    logElement.scrollTop = logElement.scrollHeight;
    console.log(logEntry);
}

// Update vault status display
function updateStatus() {
    const statusElement = document.getElementById('vault-status');
    const isSecure = vault.isSecure();
    const isLocked = vault.isLocked();
    
    let statusText = '';
    let statusClass = '';
    
    if (!isSecure) {
        statusText = 'Insecure Mode - No encryption';
        statusClass = 'insecure';
    } else if (isLocked) {
        statusText = 'Secure Mode - Locked';
        statusClass = 'locked';
    } else {
        statusText = 'Secure Mode - Unlocked';
        statusClass = 'unlocked';
    }
    
    statusElement.textContent = statusText;
    statusElement.className = `status ${statusClass}`;
}

// Tab switching functionality
window.showTab = function(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked tab
    event.target.classList.add('active');
};

// Basic Operations
window.unlockVault = async function() {
    const keyName = document.getElementById('unlock-keyname').value;
    const passcode = document.getElementById('unlock-passcode').value;
    
    if (!keyName || !passcode) {
        log('Please enter both key name and passcode', 'error');
        return;
    }
    
    try {
        const success = await vault.unlock(keyName, passcode);
        if (success) {
            log(`Vault unlocked successfully with key: ${keyName}`, 'success');
        } else {
            log('Failed to unlock vault - incorrect credentials', 'error');
        }
        updateStatus();
    } catch (error) {
        log(`Unlock error: ${error.message}`, 'error');
    }
};

window.storeData = function() {
    const key = document.getElementById('store-key').value;
    const value = document.getElementById('store-value').value;
    
    if (!key || !value) {
        log('Please enter both key and value', 'error');
        return;
    }
    
    try {
        vault.store(key, value);
        log(`Stored: ${key} = ${value}`, 'success');
        document.getElementById('store-key').value = '';
        document.getElementById('store-value').value = '';
    } catch (error) {
        log(`Store error: ${error.message}`, 'error');
    }
};

window.getData = function() {
    const key = document.getElementById('get-key').value;
    
    if (!key) {
        log('Please enter a key', 'error');
        return;
    }
    
    try {
        const value = vault.get(key);
        const resultElement = document.getElementById('get-result');
        resultElement.textContent = value !== undefined ? JSON.stringify(value, null, 2) : 'Key not found';
        log(`Retrieved: ${key} = ${value}`, 'success');
    } catch (error) {
        log(`Get error: ${error.message}`, 'error');
        document.getElementById('get-result').textContent = `Error: ${error.message}`;
    }
};

window.removeData = function() {
    const key = document.getElementById('remove-key').value;
    
    if (!key) {
        log('Please enter a key', 'error');
        return;
    }
    
    try {
        vault.remove(key);
        log(`Removed key: ${key}`, 'success');
        document.getElementById('remove-key').value = '';
    } catch (error) {
        log(`Remove error: ${error.message}`, 'error');
    }
};

// Security Operations
window.makeSecure = async function() {
    const keysJson = document.getElementById('keys-json').value;
    const keyName = document.getElementById('secure-keyname').value;
    const passcode = document.getElementById('secure-passcode').value;
    
    if (!keysJson || !keyName || !passcode) {
        log('Please enter keys JSON, key name and passcode', 'error');
        return;
    }
    
    try {
        const keys = JSON.parse(keysJson);
        await vault.secure(keys, keyName, passcode);
        log('Vault secured successfully', 'success');
        updateStatus();
    } catch (error) {
        log(`Secure error: ${error.message}`, 'error');
    }
};

window.changeKeys = async function() {
    const newKeysJson = document.getElementById('new-keys-json').value;
    
    if (!newKeysJson) {
        log('Please enter new keys JSON', 'error');
        return;
    }
    
    try {
        const newKeys = JSON.parse(newKeysJson);
        await vault.changeKeys(newKeys);
        log('Keys changed successfully', 'success');
    } catch (error) {
        log(`Change keys error: ${error.message}`, 'error');
    }
};

window.lockVault = async function() {
    try {
        await vault.lock();
        log('Vault locked', 'success');
        updateStatus();
    } catch (error) {
        log(`Lock error: ${error.message}`, 'error');
    }
};

window.makeInsecure = async function() {
    try {
        await vault.insecure();
        log('Vault made insecure', 'success');
        updateStatus();
    } catch (error) {
        log(`Make insecure error: ${error.message}`, 'error');
    }
};

// Data Management
window.refreshData = function() {
    try {
        const data = {};
        // Try to get some common test keys
        const testKeys = ['test1', 'test2', 'user', 'config', 'settings'];
        
        testKeys.forEach(key => {
            try {
                const value = vault.get(key);
                if (value !== undefined) {
                    data[key] = value;
                }
            } catch (error) {
                // Key doesn't exist or vault is locked
            }
        });
        
        document.getElementById('vault-data').textContent = JSON.stringify(data, null, 2);
        log('Data view refreshed', 'info');
    } catch (error) {
        log(`Refresh data error: ${error.message}`, 'error');
    }
};

window.checkKey = function() {
    const key = document.getElementById('check-key').value;
    
    if (!key) {
        log('Please enter a key to check', 'error');
        return;
    }
    
    try {
        const hasKey = vault.hasKey(key);
        document.getElementById('check-results').textContent = `Has key "${key}": ${hasKey}`;
        log(`Key check: ${key} = ${hasKey}`, 'info');
    } catch (error) {
        log(`Check key error: ${error.message}`, 'error');
    }
};

window.checkEmpty = function() {
    try {
        const isEmpty = vault.isEmpty();
        document.getElementById('check-results').textContent = `Vault is empty: ${isEmpty}`;
        log(`Empty check: ${isEmpty}`, 'info');
    } catch (error) {
        log(`Check empty error: ${error.message}`, 'error');
    }
};

window.storeJsonData = function() {
    const key = document.getElementById('json-key').value;
    const valueJson = document.getElementById('json-value').value;
    
    if (!key || !valueJson) {
        log('Please enter both key and JSON value', 'error');
        return;
    }
    
    try {
        const value = JSON.parse(valueJson);
        vault.store(key, value);
        log(`Stored JSON: ${key}`, 'success');
    } catch (error) {
        log(`Store JSON error: ${error.message}`, 'error');
    }
};

window.getJsonData = function() {
    const key = document.getElementById('json-key').value;
    
    if (!key) {
        log('Please enter a key', 'error');
        return;
    }
    
    try {
        const value = vault.get(key);
        document.getElementById('json-result').textContent = JSON.stringify(value, null, 2);
        log(`Retrieved JSON: ${key}`, 'success');
    } catch (error) {
        log(`Get JSON error: ${error.message}`, 'error');
    }
};

// Advanced Operations
window.generateTestKeys = async function() {
    try {
        // Generate sample encrypted keys (these would normally be created by your auth system)
        const sampleKeys = {
            password: "eyJrZGYiOiJwYmtkZjItc2hhMjU2IiwicGFyYW1zIjp7InNhbHQiOiJGZ3JQX3ozOGZPZ2lFSF9MUm1VS09nIiwiaXRlciI6MTAwMDAwLCJpdiI6IjU1NVBLT2dWc2NuWU9lMjcifSwiY3QiOiJwbkstSGNWekFJY0dRaFQ0b2VNNndnRGtwaDFVcG9vZTl3ZVE3U1ROUkN1d0ZTc2tUczBwUlV1ODBISDJlX3J3In0",
            github: "eyJrZGYiOiJwYmtkZjItc2hhMjU2IiwicGFyYW1zIjp7InNhbHQiOiJzYW1wbGVfc2FsdDIiLCJpdGVyIjoxMDAwMDAsIml2Ijoic2FtcGxlX2l2MiJ9LCJjdCI6InNhbXBsZV9jaXBoZXJ0ZXh0MiJ9"
        };
        
        document.getElementById('generated-keys').textContent = JSON.stringify(sampleKeys, null, 2);
        document.getElementById('keys-json').value = JSON.stringify(sampleKeys, null, 2);
        log('Generated sample keys (Note: These are fake keys for demo purposes)', 'info');
    } catch (error) {
        log(`Generate keys error: ${error.message}`, 'error');
    }
};

window.bulkStore = function() {
    const count = parseInt(document.getElementById('bulk-count').value) || 10;
    
    try {
        for (let i = 0; i < count; i++) {
            vault.store(`bulk_${i}`, `value_${i}_${Date.now()}`);
        }
        log(`Bulk stored ${count} items`, 'success');
    } catch (error) {
        log(`Bulk store error: ${error.message}`, 'error');
    }
};

window.bulkRetrieve = function() {
    const count = parseInt(document.getElementById('bulk-count').value) || 10;
    
    try {
        const results = {};
        for (let i = 0; i < count; i++) {
            const key = `bulk_${i}`;
            try {
                const value = vault.get(key);
                if (value !== undefined) {
                    results[key] = value;
                }
            } catch (error) {
                // Key might not exist
            }
        }
        
        document.getElementById('bulk-results').textContent = JSON.stringify(results, null, 2);
        log(`Bulk retrieved ${Object.keys(results).length} items`, 'success');
    } catch (error) {
        log(`Bulk retrieve error: ${error.message}`, 'error');
    }
};

window.destroyVault = async function() {
    if (!confirm('Are you sure you want to destroy the vault? This will remove all data.')) {
        return;
    }
    
    try {
        await vault.destroy();
        log('Vault destroyed', 'success');
        updateStatus();
    } catch (error) {
        log(`Destroy error: ${error.message}`, 'error');
    }
};

window.clearLocalStorage = function() {
    if (!confirm('Are you sure you want to clear all localStorage?')) {
        return;
    }
    
    localStorage.clear();
    log('LocalStorage cleared', 'success');
    updateStatus();
};

// Event listeners for vault events
vault.on('unlock', () => {
    log('Event: Vault unlocked', 'info');
    updateStatus();
});

vault.on('lock', () => {
    log('Event: Vault locked', 'info');
    updateStatus();
});

vault.on('secure', () => {
    log('Event: Vault secured', 'info');
    updateStatus();
});

vault.on('insecure', () => {
    log('Event: Vault made insecure', 'info');
    updateStatus();
});

vault.on('destroy', () => {
    log('Event: Vault destroyed', 'info');
    updateStatus();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    log('Demo initialized', 'info');
    updateStatus();
    
    // Set some sample data for testing
    document.getElementById('keys-json').value = JSON.stringify({"password":"eyJrZGYiOiJwYmtkZjItc2hhMjU2IiwicGFyYW1zIjp7InNhbHQiOiJCLWpWMF9sRGpZd2paTXdIaWVRblRRIiwiaXRlciI6MTAwMDAwLCJpdiI6ImQ1dElkZmpockI0eHl3UDcifSwiY3QiOiI5N3NlWWZBWkNOWUVWMlM0ZTlXMkdKZlJYcG9DdUtLTEVQc2p3MUhnRW84NjFCZ2tEdEZFd240dlZPcjZHblBqIn0"}, null, 2);
    
    document.getElementById('json-value').value = JSON.stringify({
        name: "John Doe",
        age: 30,
        preferences: {
            theme: "dark",
            language: "en"
        }
    }, null, 2);
});

window.generateTestKeys = async function() {
    try {
        const passcode = "123456";
        const authProvider = "password";
        const privateKey = "Vm1iawlOPYb5ZwokbvJomgv21gxhhXg5Jy3fEEsUtl8=";

        const rawPrivateKey = base64ToBuf(privateKey);
        // console.log("Raw private key:", rawPrivateKey);

        // 2. Derive AES key from passcode
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const keyMaterial = await crypto.subtle.importKey("raw", strToBuf(passcode), { name: "PBKDF2" }, false, ["deriveKey"]);
        const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
        );

        // 3. Encrypt private key with passcode
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, rawPrivateKey);

        // 4. Store vault entry
        const privateKeyByAuths = {
            [authProvider]: base64url(
                strToBuf(
                JSON.stringify({
                    kdf: "pbkdf2-sha256",
                    params: {
                    salt: base64url(salt),
                    iter: 100000,
                    iv: base64url(iv),
                    },
                    ct: base64url(ct),
                })
                )
            ),
        };

        log(`Key generated ${JSON.stringify(privateKeyByAuths)}`, 'success');
    } catch (error) {
        log(`Key generation failed: ${JSON.stringify(error)}`, 'error');
    }
};

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
    
function strToBuf(str) {
    return new TextEncoder().encode(str);
}

const base64url = (buf) => {
  return bufToBase64(buf)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}