import React, { useState, useRef, useEffect } from "react";
import {
  Platform,
  Animated,
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";
import { CachedImageProps } from "../types";
import { webCache } from "../webCache";
import * as CONST from "../consts";
import * as FileSystem from "expo-file-system";
import { sanitizeCacheKey } from "../utils";

const CachedImage: React.FC<CachedImageProps> = (props) => {
  const {
    source,
    cacheKey,
    placeholderContent,
    lazy = false,
    threshold = 0,
    rootMargin = "50px",
    preview,
    previewCacheKey,
    enableBlur = true,
    blurRadius = 20,
    transitionDuration = 300,
    showLoadingIndicator = false,
    loadingIndicatorColor = "#999",
    style,
    containerStyle,
    ...rest
  } = props;

  const { uri, headers, expiresIn } = source;
  const sanitizedKey = sanitizeCacheKey(cacheKey);
  const fileURI =
    Platform.OS === "web"
      ? ""
      : `${CONST.IMAGE_CACHE_FOLDER}${sanitizedKey}.png`;

  const [imgUri, setImgUri] = useState<string | null>(
    Platform.OS === "web" ? null : fileURI
  );
  const [previewUri, setPreviewUri] = useState<string | null>(preview || null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const componentIsMounted = useRef(false);
  const requestOption = headers ? { headers } : undefined;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const previewFadeAnim = useRef(new Animated.Value(1)).current;

  // Lazy loading hook
  const { targetRef, isIntersecting } = useIntersectionObserver({
    threshold,
    rootMargin,
    enabled: lazy,
  });

  useEffect(() => {
    componentIsMounted.current = true;

    // Load preview if provided and not already loaded
    if (preview && !previewUri && previewCacheKey) {
      loadPreviewImage();
    }

    // Load main image if not lazy or if intersecting
    if (!lazy || isIntersecting) {
      void loadImageAsync();
    }

    return () => {
      componentIsMounted.current = false;
      // Clean up blob URLs on web
      if (Platform.OS === "web") {
        if (imgUri?.startsWith("blob:")) {
          URL.revokeObjectURL(imgUri);
        }
        if (previewUri?.startsWith("blob:")) {
          URL.revokeObjectURL(previewUri);
        }
      }
    };
  }, [uri, cacheKey, lazy, isIntersecting]);

  const loadPreviewImage = async () => {
    if (!preview || !previewCacheKey) return;

    if (Platform.OS === "web") {
      const cachedPreview = await webCache.getImage(previewCacheKey);
      if (cachedPreview) {
        setPreviewUri(cachedPreview);
      }
    }
  };

  const animateImageLoad = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: transitionDuration,
        useNativeDriver: true,
      }),
      Animated.timing(previewFadeAnim, {
        toValue: 0,
        duration: transitionDuration,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadImageAsync = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      if (Platform.OS === "web") {
        await loadImageWeb();
      } else {
        await loadImageNative();
      }
    } catch (error) {
      setHasError(true);
      console.error("Error loading image:", error);
      if (componentIsMounted.current) {
        setImgUri(uri);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadImageWeb = async () => {
    try {
      // Check cache first
      const cachedUri = await webCache.getImage(cacheKey);

      if (cachedUri && componentIsMounted.current) {
        setImgUri(cachedUri);
        animateImageLoad();
        return;
      }

      // Download and cache
      if (componentIsMounted.current) {
        const newUri = await webCache.downloadAndCache(
          uri,
          cacheKey,
          expiresIn
        );

        if (componentIsMounted.current) {
          if (newUri) {
            setImgUri(newUri);
            animateImageLoad();
          } else {
            // Fallback to original URI if caching fails
            setImgUri(uri);
            animateImageLoad();
          }
        }
      }
    } catch (err) {
      throw err;
    }
  };

  const isImageExpired = (metadata: FileSystem.FileInfo): boolean => {
    return Boolean(
      metadata?.exists &&
        expiresIn &&
        new Date().getTime() / 1000 - metadata.modificationTime > expiresIn
    );
  };

  const shouldDownloadImage = (metadata: FileSystem.FileInfo): boolean => {
    return (
      !metadata?.exists || metadata?.size === 0 || isImageExpired(metadata)
    );
  };

  const handleSuccessfulDownload = async (
    response: FileSystem.FileSystemDownloadResult
  ) => {
    if (!componentIsMounted.current) return;

    if (response?.status === 200) {
      setImgUri(`${fileURI}?${Date.now()}`);
      animateImageLoad();
      return;
    }

    // Handle failed download
    await FileSystem.deleteAsync(fileURI, { idempotent: true });
    setImgUri(uri);
    animateImageLoad();
  };

  const downloadImage = async () => {
    if (!componentIsMounted.current) return;

    const response = await FileSystem.downloadAsync(
      uri,
      fileURI,
      requestOption
    );

    await handleSuccessfulDownload(response);
  };

  const handleExpiredImage = async () => {
    await FileSystem.deleteAsync(fileURI, { idempotent: true });
    await downloadImage();
  };

  const loadImageNative = async () => {
    try {
      const metadata = await FileSystem.getInfoAsync(fileURI);

      if (!shouldDownloadImage(metadata)) {
        // Image exists in cache and is valid
        if (componentIsMounted.current) {
          animateImageLoad();
        }
        return;
      }

      if (isImageExpired(metadata)) {
        await handleExpiredImage();
        return;
      }

      // Image doesn't exist or is empty
      await downloadImage();
    } catch (err) {
      throw err;
    }
  };

  const renderContent = () => {
    // If lazy loading is enabled and image hasn't intersected yet
    if (lazy && !isIntersecting) {
      return (
        placeholderContent || (
          <View style={[styles.placeholder, style]}>
            {showLoadingIndicator && (
              <ActivityIndicator color={loadingIndicatorColor} />
            )}
          </View>
        )
      );
    }

    // If image hasn't loaded yet
    if (!imgUri && !hasError) {
      return (
        <View style={[styles.imageContainer, style]}>
          {previewUri && (
            <Animated.Image
              source={{ uri: previewUri }}
              style={[
                StyleSheet.absoluteFillObject,
                style,
                enableBlur && { opacity: previewFadeAnim },
              ]}
              blurRadius={enableBlur ? blurRadius : 0}
              {...rest}
            />
          )}
          {(placeholderContent || (showLoadingIndicator && isLoading)) && (
            <View style={[StyleSheet.absoluteFillObject, styles.centered]}>
              {placeholderContent || (
                <ActivityIndicator color={loadingIndicatorColor} />
              )}
            </View>
          )}
        </View>
      );
    }

    // Image loaded successfully
    return (
      <View style={[styles.imageContainer, style]}>
        {previewUri && (
          <Animated.Image
            source={{ uri: previewUri }}
            style={[
              StyleSheet.absoluteFillObject,
              style,
              { opacity: previewFadeAnim },
            ]}
            blurRadius={enableBlur ? blurRadius : 0}
          />
        )}
        <Animated.Image
          {...rest}
          source={{ ...source, uri: imgUri! }}
          style={[style, { opacity: fadeAnim }]}
          onLoad={() => {
            if (componentIsMounted.current) {
              animateImageLoad();
            }
          }}
          onError={() => {
            if (componentIsMounted.current) {
              setHasError(true);
            }
          }}
        />
      </View>
    );
  };

  return (
    <View ref={targetRef} style={containerStyle}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    overflow: "hidden",
  },
  placeholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CachedImage;
