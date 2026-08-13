import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogIn, LogOut, ChevronDown, Settings } from 'lucide-react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/useAuth.js'
import UnderlineSwipe from './ui/UnderlineSwipe.jsx'

// Minimum breathing room between the wordmark and the link row before we are willing to lay
// them out side by side.
const ROW_GAP = 24

// Text-only, like the main USB site's nav. The icons this row used to carry are gone: they were
// competing with the labels at this size, and dropping them is what lets the links run larger.
// Posting to either board happens on the board itself, which is why neither has a separate
// Submit entry here.
const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/projects', label: 'Showcase' },
    { path: '/clubs', label: 'Clubs' },
    { path: '/events', label: 'Events' },
    { path: '/open-projects', label: 'Find a Project' }
]

// One shared recipe so every item in the row is the same height and sits on the same baseline.
// Nothing here scales or shifts on hover/active, so the row can never knock itself out of
// alignment; the hover feedback is the underline instead.
const linkClass =
    'group inline-flex items-center px-2 py-2 font-body text-base text-usb-ink whitespace-nowrap rounded-md outline-none focus-visible:ring-2 focus-visible:ring-black/60'

// Controls (the account button, the hamburger) get a subtle wash on hover since they have no
// text to underline.
const controlClass =
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-body font-semibold text-base text-usb-ink whitespace-nowrap transition-colors duration-200 hover:bg-black/10 outline-none focus-visible:ring-2 focus-visible:ring-black/60 cursor-pointer'

export default function NavBar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { isAuthenticated, user, logout } = useAuth()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [isCompact, setIsCompact] = useState(false)
    const rowRef = useRef(null)
    const brandRef = useRef(null)
    const brandTextRef = useRef(null)
    const linksRef = useRef(null)
    const userMenuRef = useRef(null)

    const username = user?.username

    // Collapse to the hamburger the moment the full row stops fitting rather than at a fixed
    // breakpoint. The row's real width depends on the font once it loads and on the zoom level,
    // so any hard-coded breakpoint ends up either wrapping or overlapping at some window size.
    useLayoutEffect(() => {
        const measure = () => {
            const row = rowRef.current
            const brand = brandRef.current
            const brandText = brandTextRef.current
            const links = linksRef.current
            if (!row || !brand || !brandText || !links) return

            // Lay the link row out at its natural width even while it is collapsed. Taking it
            // out of flow for the read keeps this invisible to everything else, and we restore
            // before the browser gets a chance to paint.
            const { display, position, visibility } = links.style
            links.style.display = 'flex'
            links.style.position = 'absolute'
            links.style.visibility = 'hidden'
            // scrollWidth - clientWidth is whatever the wordmark had to clip, so this stays the
            // untruncated width at every window size.
            const clipped = brandText.scrollWidth - brandText.clientWidth
            const needed = brand.scrollWidth + clipped + links.scrollWidth + ROW_GAP
            links.style.display = display
            links.style.position = position
            links.style.visibility = visibility

            setIsCompact(needed > row.clientWidth)
        }

        measure()

        const observer = new ResizeObserver(measure)
        if (rowRef.current) observer.observe(rowRef.current)
        // Widths shift once the webfont swaps in, so measure again then.
        document.fonts?.ready.then(measure)
        return () => observer.disconnect()
        // Re-measured when the account state changes: signing in swaps "Log In" for a pill
        // carrying the username, which is wider and can be what tips the row over.
    }, [isAuthenticated, username])

    // Widening the window past the collapse point hides the hamburger, so the panel it opened
    // has to go with it.
    useEffect(() => {
        if (!isCompact) setIsMenuOpen(false)
    }, [isCompact])

    // Close the desktop account dropdown on an outside click.
    useEffect(() => {
        if (!isUserMenuOpen) return
        const handleClickOutside = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setIsUserMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isUserMenuOpen])

    const isActive = (path) => (path === '/' ? location.pathname === '/' : location.pathname === path)

    const closeMenu = () => setIsMenuOpen(false)

    const handleLogout = () => {
        logout()
        navigate('/')
        closeMenu()
        setIsUserMenuOpen(false)
    }

    // The active page keeps its underline permanently drawn instead of getting a filled pill.
    // On a gold bar a filled state would have to introduce a colour the main site doesn't use.
    const navLabel = (label, active) => (
        <span className={`relative ${active ? 'font-bold' : 'font-semibold'}`}>
            {label}
            <UnderlineSwipe color="ink" active={active} />
        </span>
    )

    return (
        <motion.nav
            className="fixed top-0 left-0 right-0 bg-usb-gold shadow-lg z-50"
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div ref={rowRef} className={`relative flex items-center justify-between h-20 ${isCompact ? 'gap-4' : 'gap-6'}`}>
                    <Link
                        ref={brandRef}
                        to="/"
                        className="flex items-center gap-3 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                        onClick={closeMenu}
                    >
                        {/* The USB square icon rather than this site's own blue logo. The blue
                            was the one colour in the old theme with nowhere to sit in the brand
                            palette, and using the same mark as purdueusb.com and the Research
                            Resources site is what makes the three read as one family. */}
                        <img
                            src="/usb/usb-icon.webp"
                            alt="Purdue USB"
                            className="h-10 w-10 shrink-0 object-contain"
                            draggable={false}
                        />
                        {/* The truncate is a last resort - the step down under 360px is what
                            keeps the wordmark whole on the narrowest phones. */}
                        <span
                            ref={brandTextRef}
                            className="font-heading font-bold text-usb-ink select-none text-base sm:text-lg max-[359px]:text-sm truncate"
                        >
                            Technical Projects
                        </span>
                    </Link>

                    <div ref={linksRef} className={`${isCompact ? 'hidden' : 'flex'} items-center gap-2`}>
                        {navLinks.map((item) => (
                            <Link key={item.path} to={item.path} className={linkClass}>
                                {navLabel(item.label, isActive(item.path))}
                            </Link>
                        ))}

                        {isAuthenticated ? (
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setIsUserMenuOpen((open) => !open)}
                                    className={controlClass}
                                    title={username}
                                    aria-expanded={isUserMenuOpen}
                                >
                                    <User className="w-4 h-4 shrink-0" />
                                    {/* Usernames run to 80 characters. Capping the pill keeps a
                                        long one from pushing the row past the point where it
                                        fits - the full name is in the dropdown below. */}
                                    <span className="max-w-20 truncate">{username}</span>
                                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {isUserMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 top-full mt-2 w-56 bg-white border border-usb-border rounded-lg shadow-xl overflow-hidden"
                                        >
                                            <div className="px-4 py-3 border-b border-usb-rule font-body text-sm font-semibold text-usb-muted break-words">
                                                {username}
                                            </div>
                                            <Link
                                                to="/account"
                                                onClick={() => setIsUserMenuOpen(false)}
                                                className="flex items-center gap-2 px-4 py-3 font-body text-sm font-semibold text-usb-charcoal hover:bg-usb-gold/30 transition-colors duration-200"
                                            >
                                                <Settings className="w-4 h-4 shrink-0" />
                                                <span>Account</span>
                                            </Link>
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center gap-2 w-full px-4 py-3 font-body text-sm font-semibold text-usb-charcoal hover:bg-red-50 hover:text-red-700 transition-colors duration-200 cursor-pointer"
                                            >
                                                <LogOut className="w-4 h-4 shrink-0" />
                                                <span>Log Out</span>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link to="/login" className={controlClass}>
                                <LogIn className="w-4 h-4 shrink-0" />
                                <span>Log In</span>
                            </Link>
                        )}
                    </div>

                    <motion.button
                        onClick={() => setIsMenuOpen((open) => !open)}
                        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isMenuOpen}
                        className={`${isCompact ? 'flex' : 'hidden'} items-center shrink-0 p-2 rounded-lg text-usb-ink hover:bg-black/10 outline-none focus-visible:ring-2 focus-visible:ring-black/60 cursor-pointer`}
                        whileTap={{ scale: 0.9 }}
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            {isMenuOpen ? (
                                <motion.div
                                    key="close"
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <X className="w-7 h-7" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="menu"
                                    initial={{ rotate: 90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: -90, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Menu className="w-7 h-7" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>

                <AnimatePresence>
                    {isMenuOpen && isCompact && (
                        <motion.div
                            className="overflow-hidden border-t border-black/10 -mx-4 sm:-mx-6 bg-usb-gold"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* Capped so a short landscape window can still scroll the panel. */}
                            <div className="flex flex-col max-h-[calc(100vh-80px)] overflow-y-auto">
                                {navLinks.map((item, index) => (
                                    <motion.div
                                        key={item.path}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: index * 0.06, duration: 0.3 }}
                                    >
                                        <Link
                                            to={item.path}
                                            className="group block px-6 py-4 font-body text-lg text-usb-ink border-b border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
                                            onClick={closeMenu}
                                        >
                                            {navLabel(item.label, isActive(item.path))}
                                        </Link>
                                    </motion.div>
                                ))}

                                {isAuthenticated ? (
                                    <>
                                        {/* No username row here - the panel is a list of
                                            destinations, and "Account" already says where it
                                            goes. The desktop dropdown still shows it. */}
                                        <Link
                                            to="/account"
                                            onClick={closeMenu}
                                            className="group block px-6 py-4 font-body text-lg text-usb-ink border-b border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
                                        >
                                            {navLabel('Account', isActive('/account'))}
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-2 w-full px-6 py-4 font-body text-lg font-semibold text-usb-ink text-left hover:bg-black/10 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60 cursor-pointer"
                                        >
                                            <LogOut className="w-5 h-5 shrink-0" />
                                            <span>Log Out</span>
                                        </button>
                                    </>
                                ) : (
                                    <Link
                                        to="/login"
                                        onClick={closeMenu}
                                        className="group block px-6 py-4 font-body text-lg text-usb-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
                                    >
                                        {navLabel('Log In', isActive('/login'))}
                                    </Link>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.nav>
    )
}
