import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Track the operating system's Reduce Motion setting. */
export function useReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setIsReduced(enabled);
      })
      .catch(() => {
        if (isMounted) setIsReduced(false);
      });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setIsReduced);
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return isReduced;
}
