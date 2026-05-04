/**
 * Simple IndexedDB wrapper for persisting application state
 */

const DB_NAME = 'ExcelExplorerDB'
const STORE_NAME = 'appState'
const DB_VERSION = 1

export const storage = {
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => reject(e.target.error)
    })
  },

  async save(key, data) {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.put(data, key)
        request.onsuccess = () => resolve(true)
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('Storage save error:', err)
      return false
    }
  },

  async load(key) {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('Storage load error:', err)
      return null
    }
  },

  async clear() {
    try {
      const db = await this.init()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.clear()
        request.onsuccess = () => resolve(true)
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('Storage clear error:', err)
      return false
    }
  }
}

export const serverBackup = async (fileName, data) => {
  try {
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        data,
        timestamp: new Date().toISOString()
      })
    })
    return await res.json()
  } catch (err) {
    console.error('Server backup error:', err)
    return { error: err.message }
  }
}
