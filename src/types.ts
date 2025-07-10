import { ImageProps, ImageURISource, ViewStyle } from "react-native"

export interface CachedImage {
  key: string
  blob: Blob
  timestamp: number
  expiresIn?: number
}

export type CachedImageProps = Omit<ImageProps, "source"> & {
  cacheKey: string
  source: Omit<ImageURISource, "uri"> & { uri: string, expiresIn?: number }
  placeholderContent?: React.ReactNode
  // New props for lazy loading
  lazy?: boolean
  threshold?: number
  rootMargin?: string
  // props for progressive loading
  preview?: string // Base64 or low-quality image URL
  previewCacheKey?: string
  enableBlur?: boolean
  blurRadius?: number
  transitionDuration?: number
  // Loading indicator
  showLoadingIndicator?: boolean
  loadingIndicatorColor?: string
  containerStyle?: ViewStyle
}