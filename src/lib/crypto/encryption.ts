/**
 * Token encryption utilities using Web Crypto API
 * These functions encrypt/decrypt tokens in the browser before storing them
 */

// Generate a random encryption key for the session
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  )
}

// Export key to store in sessionStorage
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(exported)))
}

// Import key from sessionStorage
export async function importKey(keyStr: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyStr), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  )
}

// Encrypt a string value
export async function encryptValue(key: CryptoKey, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(value)

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encoded
  )

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

// Decrypt a string value
export async function decryptValue(key: CryptoKey, encryptedValue: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedValue), (c) => c.charCodeAt(0))

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encrypted
  )

  return new TextDecoder().decode(decrypted)
}

// Session storage helpers with encryption
export async function storeEncrypted(key: string, value: string): Promise<void> {
  let encryptionKey: CryptoKey
  const storedKey = sessionStorage.getItem('_encryption_key')

  if (storedKey) {
    encryptionKey = await importKey(storedKey)
  } else {
    encryptionKey = await generateEncryptionKey()
    const exportedKey = await exportKey(encryptionKey)
    sessionStorage.setItem('_encryption_key', exportedKey)
  }

  const encrypted = await encryptValue(encryptionKey, value)
  sessionStorage.setItem(key, encrypted)
}

export async function retrieveEncrypted(key: string): Promise<string | null> {
  const storedKey = sessionStorage.getItem('_encryption_key')
  if (!storedKey) return null

  const encryptedValue = sessionStorage.getItem(key)
  if (!encryptedValue) return null

  try {
    const encryptionKey = await importKey(storedKey)
    return await decryptValue(encryptionKey, encryptedValue)
  } catch (error) {
    console.error('Failed to decrypt value:', error)
    return null
  }
}
