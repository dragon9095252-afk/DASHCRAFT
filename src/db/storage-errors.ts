export type StorageErrorCode = 'unavailable' | 'quota' | 'unknown'

export class StorageError extends Error {
  readonly code: StorageErrorCode

  constructor(code: StorageErrorCode, message: string) {
    super(message)
    this.name = 'StorageError'
    this.code = code
  }
}

function errorName(cause: unknown): string {
  return cause instanceof Error ? cause.name : ''
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause ?? '')
}

export function toStorageError(cause: unknown): StorageError {
  if (cause instanceof StorageError) return cause

  const name = errorName(cause)
  const message = errorMessage(cause)

  if (name === 'MissingAPIError' || /indexeddb|indexed db/i.test(message)) {
    return new StorageError('unavailable', 'IndexedDB tidak tersedia di browser ini.')
  }
  if (name === 'QuotaExceededError' || /quota|storage.*full/i.test(message)) {
    return new StorageError('quota', 'Ruang penyimpanan browser penuh.')
  }
  return new StorageError('unknown', 'Penyimpanan lokal gagal diakses.')
}

export function storageErrorMessage(error: StorageError): string {
  switch (error.code) {
    case 'unavailable':
      return 'Penyimpanan browser tidak tersedia. Data tetap bisa dipakai selama tab ini terbuka.'
    case 'quota':
      return 'Ruang penyimpanan browser penuh. Hapus data lokal di Pengaturan lalu coba lagi.'
    case 'unknown':
      return 'Data gagal disimpan. Coba lagi, atau hapus data lokal bila masalah berlanjut.'
  }
}
