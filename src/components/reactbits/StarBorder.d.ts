import type { CSSProperties, ElementType, ReactNode } from 'react';

export interface StarBorderProps {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  color?: string;
  trailColor?: string;
  duration?: number;
  thickness?: number;
  radius?: number;
  trailLength?: number;
  stars?: number;
  glow?: number;
  sparkle?: boolean;
  direction?: 'clockwise' | 'counterclockwise';
  hover?: 'lap' | 'brighten' | 'reveal' | 'none';
  clickPulse?: boolean;
  theme?: 'dark' | 'light';
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  [prop: string]: unknown;
}

declare const StarBorder: (props: StarBorderProps) => ReactNode;
export default StarBorder;
