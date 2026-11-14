// gsap's package ships no type entry for this sub-path under "bundler" resolution.
declare module 'gsap/ScrollTrigger' {
  export const ScrollTrigger: {
    refresh: (safe?: boolean) => void;
    [key: string]: unknown;
  };
}
