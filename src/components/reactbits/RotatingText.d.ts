import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from 'react';

export interface RotatingTextHandle {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

export interface RotatingTextProps {
  texts: string[];
  effect?: 'slide' | 'flip' | 'blur' | 'scale' | 'drop';
  direction?: 'up' | 'down';
  highlight?: boolean;
  highlightColor?: string;
  animatePresenceMode?: 'wait' | 'sync' | 'popLayout';
  animatePresenceInitial?: boolean;
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: 'first' | 'last' | 'center' | 'random' | number;
  loop?: boolean;
  auto?: boolean;
  pauseOnHover?: boolean;
  blur?: number;
  splitBy?: 'characters' | 'words' | 'lines' | string;
  onNext?: (index: number) => void;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
  style?: CSSProperties;
}

declare const RotatingText: ForwardRefExoticComponent<RotatingTextProps & RefAttributes<RotatingTextHandle>>;
export default RotatingText;
