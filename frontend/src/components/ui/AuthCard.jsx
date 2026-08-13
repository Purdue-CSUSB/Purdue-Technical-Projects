// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'

// The shell shared by login, signup, verification and forgot-password. All of them are a single
// centred card with a title, a subtitle, at most one banner, and a form - so the shape lives
// here once.

export function Banner({ tone, children }) {
    if (!children) return null
    // The success palette is the main site's (#D1FAE5 over #065F46); errors use the same weight
    // of red so a page that can show either doesn't jump in contrast.
    const styles =
        tone === 'success'
            ? 'bg-[#D1FAE5] border-[#A7F3D0] text-[#065F46]'
            : 'bg-red-50 border-red-200 text-red-700'

    // A plain div, matching the Research Resources banner exactly. It was briefly animated in;
    // that is reverted both to keep the two sites identical and because a static element cannot
    // fail to paint - there is no animation state it can get stuck in.
    return (
        <div role={tone === 'success' ? 'status' : 'alert'} className={`mb-5 px-4 py-3 rounded-lg border font-body text-sm ${styles}`}>
            {children}
        </div>
    )
}

export default function AuthCard({ title, subtitle, children }) {
    return (
        // Full-bleed charcoal, matching the homepage's dark bands. `flex-1` fills the space
        // between nav and footer so the colour reaches the footer instead of stopping at the
        // card and leaving a strip of the page backdrop below it.
        <div className="flex-1 bg-usb-charcoal py-16 px-6 flex items-start justify-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full max-w-md bg-white border border-usb-border rounded-2xl shadow-lg p-8"
            >
                <h1 className="font-heading font-extrabold text-3xl text-usb-charcoal mb-2">{title}</h1>
                {subtitle && <p className="font-body text-usb-muted mb-6">{subtitle}</p>}
                {children}
            </motion.div>
        </div>
    )
}
