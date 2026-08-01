// Scroll-driven cinematic tour configuration.
// Each zone maps a percentage range of the pinned scroll section to either
// a text-led hero moment (no footage available) or a preloaded frame sequence.
export const TOUR_ZONES = [
  {
    key: 't1',
    start: 0,
    end: 15,
    kind: 'hero',
    number: '01',
    captionAr: 'الواجهة الخارجية',
    captionEn: 'Exterior Facade',
  },
  {
    key: 't2',
    start: 16,
    end: 30,
    kind: 'frames',
    folder: 't2',
    frameCount: 73,
    number: '02',
    captionAr: 'حمام السباحة إلى الصالة الداخلية',
    captionEn: 'Pool to Indoor Lounge',
  },
  {
    key: 't3',
    start: 31,
    end: 45,
    kind: 'frames',
    folder: 't3',
    frameCount: 73,
    number: '03',
    captionAr: 'الصالة إلى غرفة التلفزيون',
    captionEn: 'Lounge to TV Room',
  },
  {
    key: 't4',
    start: 46,
    end: 60,
    kind: 'frames',
    folder: 't4',
    frameCount: 73,
    number: '04',
    captionAr: 'غرفة التلفزيون إلى صالة البلياردو',
    captionEn: 'TV Room to Billiard Lounge',
  },
  {
    key: 't5',
    start: 61,
    end: 75,
    kind: 'frames',
    folder: 't5',
    frameCount: 73,
    number: '05',
    captionAr: 'صالة البلياردو إلى الدرج المعماري',
    captionEn: 'Billiard Room to the Staircase',
  },
  {
    key: 't6',
    start: 76,
    end: 100,
    kind: 'frames',
    folder: 't6',
    frameCount: 97,
    number: '06',
    captionAr: 'الدرج إلى غرفة النوم الرئيسية',
    captionEn: 'Staircase to the Master Bedroom',
  },
]

export const TOTAL_FRAME_COUNT = TOUR_ZONES.filter((z) => z.kind === 'frames').reduce(
  (sum, z) => sum + z.frameCount,
  0,
)

export function frameUrl(folder, index) {
  const n = String(index + 1).padStart(4, '0')
  return `${import.meta.env.BASE_URL}frames/${folder}/f_${n}.jpg`
}
