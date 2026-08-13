import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'

// Backdrop, entrance animation, and the two ways out (click outside, press Escape) shared by
// every dialog in the app. Escape is wired here rather than per-modal so no dialog can end up
// dismissible by mouse but not by keyboard.
//
// Rendered through a portal onto <body>, which is load-bearing rather than tidiness. Dialogs
// are declared inside the routed content, which lives in <main class="relative z-10">. That
// makes a stacking context, so the backdrop's z-60 would only ever compete against its siblings
// inside main - the navbar (z-50) and footer, both anchored at the root, would paint straight
// over the top and bottom of the panel. The routed content is also inside a transformed
// motion.div during page transitions, and a transform makes a fixed child position against
// that ancestor instead of the viewport. Portalling to body escapes both.
export default function ModalShell({ open, onDismiss, className = '', children, panelClassName = '' }) {
    // Whether the current press started on the backdrop itself - see the handlers below.
    const pressedBackdrop = useRef(false)

    useEffect(() => {
        if (!open) return
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onDismiss?.()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [open, onDismiss])

    // Hold the page still behind the dialog, compensating for the scrollbar's width so the
    // layout doesn't jump sideways as it disappears.
    useEffect(() => {
        if (!open) return
        const { body } = document
        const scrollbar = window.innerWidth - document.documentElement.clientWidth
        const prevOverflow = body.style.overflow
        const prevPadding = body.style.paddingRight
        body.style.overflow = 'hidden'
        if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
        return () => {
            body.style.overflow = prevOverflow
            body.style.paddingRight = prevPadding
        }
    }, [open])

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${className}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    // Dismiss only when the press AND the release both land on the backdrop.
                    // A plain onClick here closes the dialog when someone drag-selects text in a
                    // field and lets go past the panel's edge: the release lands on the
                    // backdrop, so the click fires on the two elements' common ancestor, which
                    // is the backdrop. Tracking the press target instead means a drag that
                    // began inside the panel can never dismiss it, however far it wanders.
                    onPointerDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget }}
                    onPointerUp={(e) => {
                        if (pressedBackdrop.current && e.target === e.currentTarget) onDismiss?.()
                        pressedBackdrop.current = false
                    }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        className={`bg-white rounded-2xl w-full shadow-2xl ${panelClassName}`}
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ duration: 0.25 }}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    )
}
