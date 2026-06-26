export type SkinId = 'nebula' | 'aurora' | 'ember' | 'slate' | 'neon'
export type ThemeMode = 'dark' | 'light'

export interface SkinMeta {
  id: SkinId
  name: string
  blurb: string
  /** The dot color shown in the compact picker (the skin's brand hue). */
  dot: string
  /** Static swatch colors for the preview card (dark-mode values). */
  preview: {
    app: string
    panel: string
    ink: string
    brand: string
    teamAlpha: string
    teamBravo: string
  }
}

/**
 * Static metadata for the picker UI only. The real, authoritative token values
 * live in globals.css under each [data-skin] selector. These hex values mirror
 * the dark-mode tokens so the dropdown preview matches the live theme.
 */
export const SKINS: SkinMeta[] = [
  {
    id: 'nebula',
    name: 'Nebula',
    blurb: 'Violet on near-black',
    dot: '#8b5cf6',
    preview: {
      app: '#0a0710',
      panel: '#1e172e',
      ink: '#f3f0fa',
      brand: '#8b5cf6',
      teamAlpha: '#818cf8',
      teamBravo: '#f472b6',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'Teal on cool slate',
    dot: '#2dd4bf',
    preview: {
      app: '#0b1418',
      panel: '#162a34',
      ink: '#e6f1f4',
      brand: '#2dd4bf',
      teamAlpha: '#22d3ee',
      teamBravo: '#fbbf24',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'Orange on warm charcoal',
    dot: '#f97316',
    preview: {
      app: '#120d0a',
      panel: '#271a13',
      ink: '#f7efe8',
      brand: '#f97316',
      teamAlpha: '#fb923c',
      teamBravo: '#38bdf8',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    blurb: 'Neutral broadcast dark',
    dot: '#3ea6ff',
    preview: {
      app: '#0f0f0f',
      panel: '#272727',
      ink: '#f1f1f1',
      brand: '#3ea6ff',
      teamAlpha: '#3b82f6',
      teamBravo: '#f97316',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    blurb: 'Glassmorphism · electric green',
    dot: '#22ff88',
    preview: {
      app: '#04070a',
      panel: '#15241c',
      ink: '#eafff2',
      brand: '#22ff88',
      teamAlpha: '#22ffcc',
      teamBravo: '#ff3d8b',
    },
  },
]

export const DEFAULT_SKIN: SkinId = 'nebula'
export const DEFAULT_MODE: ThemeMode = 'dark'
