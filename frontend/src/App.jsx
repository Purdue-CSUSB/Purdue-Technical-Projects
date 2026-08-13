import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import NavBar from './components/NavBar.jsx'
import Footer from './components/Footer.jsx'
import HomePage from './pages/HomePage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import OpenProjectsPage from './pages/OpenProjectsPage.jsx'
import ClubsPage from './pages/ClubsPage.jsx'
import EventsPage from './pages/EventsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

function ScrollToTop() {
    const { pathname } = useLocation()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [pathname])

    return null
}

function PageWrapper({ children }) {
    return (
        <motion.div
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    )
}

function AppRoutes() {
    const location = useLocation()

    // The column layout is what keeps the footer at the bottom of the viewport on the short
    // pages (404, an empty board) instead of floating halfway up. pt-20 clears the fixed navbar.
    return (
        <div className="min-h-screen flex flex-col">
            <ScrollToTop />
            {/* The main USB site's two-tone diagonal, used as a backdrop for every page. This is
                what replaced the animated three.js wire mesh: that was a full-screen WebGL
                canvas running a render loop for the entire visit, it only worked against a dark
                theme, and it pulled in the single largest dependency in the bundle. The wedge is
                one gradient and costs nothing.

                Fixed to the viewport rather than sized to the page. `to bottom right` takes its
                angle from its box, so anchoring this to the routed content would make the
                diagonal shallower on a long page than a short one, and a fixed-height band would
                instead run out partway down and leave the rest of a long page bare. Pinning it
                to the viewport solves both: the wedge is pixel-identical on every route, and a
                page of any length scrolls over it without ever running past it.

                Content sits above via z-10; the homepage's opaque charcoal hero covers it. */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0"
                style={{ background: 'linear-gradient(to bottom right, #FFCA44 50%, #F8F7F3 50%)' }}
            />
            <NavBar />
            <main className="relative z-10 flex-1 pt-20 flex flex-col">
                <div className="flex-1 flex flex-col">
                    <AnimatePresence mode="wait">
                        <Routes location={location} key={location.pathname}>
                            <Route path="/" element={<PageWrapper><HomePage /></PageWrapper>} />
                            <Route path="/projects" element={<PageWrapper><ProjectsPage /></PageWrapper>} />
                            <Route path="/open-projects" element={<PageWrapper><OpenProjectsPage /></PageWrapper>} />
                            <Route path="/clubs" element={<PageWrapper><ClubsPage /></PageWrapper>} />
                            <Route path="/events" element={<PageWrapper><EventsPage /></PageWrapper>} />
                            {/* Submitting is a dialog on the showcase now. ?post=1 opens it,
                                so an old /submit link still ends where the form is. */}
                            <Route path="/submit" element={<Navigate to="/projects?post=1" replace />} />

                            <Route path="/login" element={<PageWrapper><LoginPage /></PageWrapper>} />
                            <Route path="/signup" element={<PageWrapper><SignupPage /></PageWrapper>} />
                            <Route path="/forgot-password" element={<PageWrapper><ForgotPasswordPage /></PageWrapper>} />
                            <Route path="/account" element={<PageWrapper><AccountPage /></PageWrapper>} />

                            {/* These paths used to be capitalised (/Projects, /Clubs, ...) and
                                anything already linked or bookmarked still resolves: React
                                Router matches case-insensitively unless a route opts into
                                `caseSensitive`, so /Projects lands on the route below it. No
                                redirect routes are needed - they would never be reached. */}

                            <Route path="*" element={<PageWrapper><NotFoundPage /></PageWrapper>} />
                        </Routes>
                    </AnimatePresence>
                </div>
            </main>
            <div className="relative z-10">
                <Footer />
            </div>
        </div>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    )
}
