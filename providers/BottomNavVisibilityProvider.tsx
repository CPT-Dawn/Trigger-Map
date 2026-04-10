import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface BottomNavVisibilityContextValue {
  visible: boolean;
  showNav: () => void;
  hideNav: () => void;
}

const BottomNavVisibilityContext = createContext<BottomNavVisibilityContextValue | undefined>(undefined);

export function BottomNavVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(true);

  const showNav = useCallback(() => {
    if (!visibleRef.current) {
      visibleRef.current = true;
      setVisible(true);
    }
  }, []);

  const hideNav = useCallback(() => {
    if (visibleRef.current) {
      visibleRef.current = false;
      setVisible(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      visible,
      showNav,
      hideNav,
    }),
    [visible, showNav, hideNav]
  );

  return <BottomNavVisibilityContext.Provider value={value}>{children}</BottomNavVisibilityContext.Provider>;
}

export function useBottomNavVisibility() {
  const context = useContext(BottomNavVisibilityContext);

  if (!context) {
    throw new Error('useBottomNavVisibility must be used within a BottomNavVisibilityProvider.');
  }

  return context;
}

export function useBottomNavScrollBehavior() {
  const { showNav, hideNav } = useBottomNavVisibility();
  const lastOffsetY = useRef(0);

  const resetScrollTracking = useCallback(() => {
    lastOffsetY.current = 0;
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffsetY = event.nativeEvent.contentOffset.y;
      const deltaY = nextOffsetY - lastOffsetY.current;

      lastOffsetY.current = nextOffsetY;

      if (nextOffsetY <= 24) {
        showNav();
        return;
      }

      if (deltaY > 10 && nextOffsetY > 56) {
        hideNav();
        return;
      }

      if (deltaY < -10) {
        showNav();
      }
    },
    [hideNav, showNav]
  );

  return {
    onScroll,
    resetScrollTracking,
    scrollEventThrottle: 16 as const,
  };
}