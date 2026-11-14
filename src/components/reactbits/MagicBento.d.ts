import type { CSSProperties, ReactNode } from 'react';

export interface MagicBentoItem {
  id?: string;
  title?: string;
  description?: string;
  label?: ReactNode;
  icon?: ReactNode;
  visual?: string | ReactNode;
  content?: ReactNode;
  image?: string;
  colSpan?: number;
  rowSpan?: number;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: (event: unknown) => void;
}

export interface MagicBentoProps {
  items?: MagicBentoItem[];
  columns?: number;
  rowHeight?: number;
  gap?: number;
  radius?: number;
  theme?: 'dark' | 'light';
  glowColor?: string;
  textAutoHide?: boolean;
  enableBorderGlow?: boolean;
  enableSpotlight?: boolean;
  spotlightRadius?: number;
  enableStars?: boolean;
  particleCount?: number;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  intro?: boolean;
  disableAnimations?: boolean;
  onItemClick?: (item: MagicBentoItem, index: number) => void;
  className?: string;
  style?: CSSProperties;
}

declare const MagicBento: (props: MagicBentoProps) => ReactNode;
export default MagicBento;
