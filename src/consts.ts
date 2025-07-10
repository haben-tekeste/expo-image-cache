import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export const DB_NAME = 'ImageCacheDB'
export const DB_VERSION = 1
export const STORE_NAME = 'images'

export const IMAGE_CACHE_FOLDER =
  Platform.OS === "web" ? "image-cache" : `${FileSystem.cacheDirectory}`;

