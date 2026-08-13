import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CARD_HOVER_SHADOW, HOVER_SHADOW, HOVER_TRANSITION } from './motion.js'

// One button for the whole app. Renders as a <button>, a router <Link>, or an <a> depending on
// which navigation prop it gets, so a call site never has to rebuild the styling just because
// the destination changed shape. The pages used to repeat a 200-character Tailwind string for
// every single call to action, which is how they drifted apart in the first place.

// Built once at module scope. Calling motion.create() during render would hand React a brand
// new component type on every pass, which remounts the button and drops its animation state.
const MotionButton = motion.button
const MotionLink = motion.create(Link)
const MotionAnchor = motion.a

const VARIANTS = {
    // The main site's primary CTA: gold fill, black label.
    gold: 'bg-usb-gold text-black hover:bg-[#F0B72B]',
    dark: 'bg-usb-charcoal text-white hover:bg-black',
    // Charcoal fill with a gold label - for a primary action that sits on the gold half of
    // the page backdrop, where a gold button would disappear into it.
    darkGold: 'bg-usb-charcoal text-usb-gold hover:bg-black',
    outline: 'bg-transparent text-usb-charcoal border border-usb-charcoal hover:bg-usb-charcoal hover:text-white',
    // Outlined in white, for the charcoal sections.
    ghostLight: 'bg-transparent text-white border border-white/70 hover:bg-white hover:text-usb-charcoal',
    neutral: 'bg-gray-100 text-usb-charcoal border border-usb-border hover:bg-gray-200',
    // Outlined, inverting to charcoal on hover. The secondary action next to a gold primary.
    ghost: 'bg-white text-usb-charcoal border border-usb-border hover:bg-usb-charcoal hover:text-white'
}

const SIZES = {
    // Square, for an icon-only control.
    icon: 'p-2 text-sm',
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-3 text-lg'
}

export default function Button({
    to,
    href,
    variant = 'gold',
    size = 'md',
    className = '',
    disabled = false,
    fullWidth = false,
    // true    - the full lift, for a standalone call to action.
    // 'subtle' - a smaller scale and a softer shadow, for a primary action sitting in a row of
    //            secondary ones: enough to read as the main button without jumping off the page.
    // false   - no motion at all; the variant's colour change carries the hover.
    lift = true,
    type = 'button',
    children,
    ...rest
}) {
    // `group` so a label wrapped in <UnderlineSwipe> can react to hovering the whole button,
    // the same way the navbar links do.
    const base = `group inline-flex items-center justify-center gap-2 rounded-lg font-body font-semibold text-center outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-usb-charcoal focus-visible:ring-offset-2 ${SIZES[size]} ${fullWidth ? 'w-full' : ''}`

    // A disabled control must not animate or look pressable, so the motion props are dropped
    // entirely rather than merely overridden.
    const classes = disabled
        ? `${base} bg-gray-200 text-usb-muted cursor-not-allowed ${className}`
        : `${base} ${VARIANTS[variant]} cursor-pointer ${className}`

    const motionProps = disabled || !lift
        ? {}
        : {
            whileHover: lift === 'subtle'
                ? { scale: 1.015, boxShadow: CARD_HOVER_SHADOW }
                : { scale: 1.03, boxShadow: HOVER_SHADOW },
            whileTap: { scale: 0.98 },
            transition: HOVER_TRANSITION,
            style: { willChange: 'transform, box-shadow' }
        }

    if (to) {
        return (
            <MotionLink to={to} {...motionProps} {...rest} className={classes}>
                {children}
            </MotionLink>
        )
    }

    if (href) {
        return (
            <MotionAnchor href={href} {...motionProps} {...rest} className={classes}>
                {children}
            </MotionAnchor>
        )
    }

    return (
        <MotionButton type={type} disabled={disabled} {...motionProps} {...rest} className={classes}>
            {children}
        </MotionButton>
    )
}
