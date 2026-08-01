# عريب للتطوير العقاري — THE STONE

Bilingual (Arabic / English) single-page luxury real estate experience for Areeb Real Estate
Development's "THE STONE" project, built with React, Vite, Tailwind CSS and GSAP ScrollTrigger.

## Getting started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## How it's put together

- `src/components/CinematicTour.jsx` — the scroll-driven canvas engine. It preloads every frame
  under `public/frames/tN/` and scrubs through them as the user scrolls, pinned via GSAP
  ScrollTrigger. Chapter captions, the progress bar and the side navigation dots are driven
  imperatively (no React re-render per scroll tick) for smooth 60fps scrubbing.
- `src/data/tourSections.js` — the percentage ranges, frame folders/counts, and bilingual
  captions for each of the 6 cinematic chapters.
- `src/i18n/` — the language context (Arabic default, English toggle) and the full bilingual
  copy dictionary. Toggling language flips `document.dir`/`lang` for full RTL/LTR layout support.
- `src/components/ProjectShowcase.jsx`, `FloorPlans.jsx`, `StructuralModels.jsx`,
  `Warranties.jsx`, `LocationMap.jsx` — the sections below the cinematic tour (project features,
  floor distribution tabs, structural model gallery, warranty grid, and the Google Maps CTA).

## Known content gaps

The 6 cinematic transitions were mapped from the 5 interior walkthrough clips that were supplied.
None of the supplied footage shows the villa's exterior facade, so **Chapter 01 (Exterior
Facade)** currently renders as a text-led hero (brand name, tagline and credits over a dark
gradient) rather than scrubbed video frames. Drop an exterior sequence into
`public/frames/t1/f_0001.jpg …` and wire it into the `t1` entry in `src/data/tourSections.js`
(mirroring the other zones' `kind: 'frames'` shape) to complete it.

The **Structural Models gallery** (Model A / Model B) also renders as labeled placeholder plates
since no blueprint images were supplied. Drop the real plans into `public/models/A/1.jpg`,
`public/models/A/2.jpg`, `public/models/A/3.jpg` (and the same for `B/`) and they'll appear
automatically — the component already points at those paths.
