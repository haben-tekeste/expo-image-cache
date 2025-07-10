export interface CachedImage {
  key: string
  blob: Blob
  timestamp: number
  expiresIn?: number
}