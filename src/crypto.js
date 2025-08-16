/**
 * Pushbullet End-to-End Encryption Module
 * Implements AES-256-GCM encryption with PBKDF2 key derivation
 * Based on Pushbullet API documentation
 */

class PushbulletCrypto {
  constructor() {
    this.encryptionKey = null;
    this.userIden = null;
  }

  /**
   * Initialize encryption with user password and iden
   * @param {string} password - User's encryption password
   * @param {string} userIden - User's Pushbullet iden (used as salt)
   */
  async initialize(password, userIden) {
    if (!password || !userIden) {
      throw new Error('Password and user iden are required');
    }
    
    this.userIden = userIden;
    this.encryptionKey = await this.deriveKey(password, userIden);
  }

  /**
   * Derive encryption key using PBKDF2
   * @param {string} password - User's encryption password
   * @param {string} salt - User's iden as salt
   * @returns {CryptoKey} Derived encryption key
   */
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);

    // Import password as a key
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive the actual encryption key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 30000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true, // extractable for export
      ['decrypt']
    );

    return key;
  }

  /**
   * Export key to base64 for storage
   * @returns {string} Base64 encoded key
   */
  async exportKey() {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    const exported = await crypto.subtle.exportKey('raw', this.encryptionKey);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Import key from base64
   * @param {string} base64Key - Base64 encoded key
   */
  async importKey(base64Key) {
    const keyBuffer = this.base64ToArrayBuffer(base64Key);
    this.encryptionKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt']
    );
  }


  /**
   * Decrypt an encrypted message
   * @param {string} encryptedMessage - Base64 encoded encrypted message
   * @returns {object|string} Decrypted message
   */
  async decrypt(encryptedMessage) {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    const combined = new Uint8Array(this.base64ToArrayBuffer(encryptedMessage));

    // Check version
    if (combined[0] !== 49) { // '1' in ASCII
      throw new Error('Invalid encryption version');
    }

    // Extract components
    const tag = combined.slice(1, 17);
    const iv = combined.slice(17, 29);
    const ciphertext = combined.slice(29);

    // Combine ciphertext and tag for decryption (GCM expects them together)
    const encryptedData = new Uint8Array(ciphertext.length + tag.length);
    encryptedData.set(ciphertext, 0);
    encryptedData.set(tag, ciphertext.length);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.encryptionKey,
      encryptedData
    );

    // Convert to string
    const decoder = new TextDecoder();
    const decryptedStr = decoder.decode(decrypted);

    // Try to parse as JSON, otherwise return as string
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  }

  /**
   * Check if a push object is encrypted
   * @param {object} push - Push object from Pushbullet
   * @returns {boolean} True if encrypted
   */
  isEncrypted(push) {
    return push && push.encrypted === true && push.ciphertext;
  }

  /**
   * Process an ephemeral message (decrypt if encrypted)
   * @param {object} ephemeral - Ephemeral object from WebSocket
   * @returns {object} Processed ephemeral with decrypted data if applicable
   */
  async processEphemeral(ephemeral) {
    if (!ephemeral || !ephemeral.push) {
      return ephemeral;
    }

    // Check if the push is encrypted
    if (this.isEncrypted(ephemeral.push)) {
      if (!this.encryptionKey) {
        console.warn('Received encrypted ephemeral but encryption is not configured');
        return ephemeral;
      }

      try {
        // Decrypt the ciphertext
        const decryptedData = await this.decrypt(ephemeral.push.ciphertext);
        
        // Replace encrypted push with decrypted data
        ephemeral.push = {
          ...ephemeral.push,
          ...decryptedData,
          encrypted: false,
          was_encrypted: true
        };
        delete ephemeral.push.ciphertext;
      } catch (error) {
        console.error('Failed to decrypt ephemeral:', error);
        // Keep the original encrypted ephemeral
      }
    }

    return ephemeral;
  }


  // Utility functions
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Clear encryption key from memory
   */
  clear() {
    this.encryptionKey = null;
    this.userIden = null;
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PushbulletCrypto;
}