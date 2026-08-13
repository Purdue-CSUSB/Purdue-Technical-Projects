// The main USB site's motion vocabulary, in one place so every page animates identically.
// Three gestures cover the whole design: things fade up on mount, buttons scale and cast a
// shadow on hover, cards do the same a little more gently.
//
// This replaces the per-element framer-motion props the old pages carried, where the same lift
// was spelled out inline a dozen times with slightly different durations and easings each time.

// Buttons and other primary controls.
export const HOVER_SHADOW = '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1)'
// Cards and panels - the same shape at half the opacity, so a grid of them doesn't read as noisy.
export const CARD_HOVER_SHADOW = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'

export const HOVER_TRANSITION = { duration: 0.18, ease: 'easeOut' }

// Mount animation. `index` staggers a list without every caller reinventing the arithmetic;
// the delay is capped so a long grid doesn't leave its last row hanging for seconds.
export const fadeUp = (index = 0, base = 0.05) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: 'easeOut', delay: Math.min(base + index * 0.05, 0.6) }
})

export const fadeDown = (delay = 0) => ({
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: 'easeOut', delay }
})
