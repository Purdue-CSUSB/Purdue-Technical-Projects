import UnderlineSwipe from './ui/UnderlineSwipe.jsx'

// Mirrors the footer on purdueusb.com almost exactly - same gold bar, same three destinations,
// same icon-only treatment on narrow screens. It is the clearest signal that this site is part
// of USB rather than a separate product, so the copy and links are deliberately identical to
// the ones the Research Resources site carries.
//
// It also replaces the "Connect with USB" block that used to be pasted into the bottom of the
// home page only, which meant every other page ended on nothing at all.

const linkClass =
    'group flex items-center gap-2 font-body font-semibold text-usb-ink transition-transform duration-150 hover:scale-105 outline-none focus-visible:ring-2 focus-visible:ring-black/60 rounded-md'

export default function Footer() {
    return (
        <footer className="px-8 py-6 shadow-inner bg-usb-gold">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                <a href="https://purdueusb.com/" target="_blank" rel="noopener noreferrer" className="flex items-center">
                    <img
                        src="/usb/usb-long-logo.svg"
                        alt="Purdue USB"
                        className="h-16 w-auto cursor-pointer"
                        draggable={false}
                    />
                </a>

                <div className="flex items-center gap-8">
                    <a
                        href="https://www.instagram.com/purdueusb/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                    >
                        <img src="/usb/instagram.svg" alt="" aria-hidden="true" className="w-6 h-6" />
                        <span className="hidden sm:inline relative">
                            Instagram
                            <UnderlineSwipe color="ink" />
                        </span>
                        <span className="sr-only sm:hidden">Instagram</span>
                    </a>

                    <a href="mailto:usb@cs.purdue.edu" className={linkClass}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                            <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                            <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                        </svg>
                        <span className="hidden sm:inline relative">
                            Email
                            <UnderlineSwipe color="ink" />
                        </span>
                        <span className="sr-only sm:hidden">Email</span>
                    </a>

                    <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLScv6lNPqYwarlTKhdp5O8htD0DzRKmNRZNln0LPwj8EslcjYA/viewform"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                            <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM12.75 12a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V18a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V12z" clipRule="evenodd" />
                            <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
                        </svg>
                        <span className="hidden sm:inline relative">
                            Newsletter
                            <UnderlineSwipe color="ink" />
                        </span>
                        <span className="sr-only sm:hidden">Newsletter</span>
                    </a>
                </div>
            </div>

            <div className="max-w-6xl mx-auto mt-4 pt-4 border-t border-black/10 text-center">
                <p className="font-body text-sm" style={{ color: '#000000CC' }}>
                    © {new Date().getFullYear()} Undergraduate Student Board. All rights reserved.
                </p>
            </div>
        </footer>
    )
}
