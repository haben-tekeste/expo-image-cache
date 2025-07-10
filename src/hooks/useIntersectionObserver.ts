import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

interface UseIntersectionObserverProps {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export const useIntersectionObserver = ({
  threshold = 0,
  rootMargin = "50px",
  enabled = true,
}: UseIntersectionObserverProps = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || Platform.OS !== "web" || !targetRef.current) {
      if (!enabled || Platform.OS !== "web") {
        setIsIntersecting(true); // Always visible on native
      }
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold,
        rootMargin,
      }
    );

    const element = targetRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [enabled, threshold, rootMargin]);

  return { targetRef, isIntersecting };
};
