import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Users, Trophy, Handshake, Globe, Camera } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import Button from '../components/ui/Button.jsx';
import UnderlineSwipe from '../components/ui/UnderlineSwipe.jsx';
import { fadeUp } from '../components/ui/motion.js';
import ProjectMarquee from '../components/ProjectMarquee.jsx';
import ProjectDetailModal from '../components/ProjectDetailModal.jsx';
import { getProjects } from '../services/api.js';
import { CACHE_KEYS, isStale, readCache, revalidate } from '../lib/apiCache.js';

// Internal shortcuts into the rest of the site. Nothing new lives here - it is the same
// navigation the header offers, surfaced where a first-time visitor will actually look.
const startingPoints = [
    {
        to: '/projects',
        icon: FolderOpen,
        title: 'Browse the Showcase',
        body: 'Everything Purdue students have built and posted - personal projects, class work, and hackathon entries.'
    },
    {
        // The site's other half. The hero's second button already covers submitting, so this
        // slot goes to the thing a visitor is least likely to know exists.
        to: '/open-projects',
        icon: Handshake,
        title: 'Find a Project',
        body: 'Projects being built right now that are looking for people. Find one that needs what you can do.'
    },
    {
        to: '/clubs',
        icon: Users,
        title: 'Find a Club',
        body: 'The technical clubs and student organizations building things on campus, and how to reach them.'
    },
    {
        to: '/events',
        icon: Trophy,
        title: 'Competitions',
        body: 'Hackathons and competitions at Purdue - where to sign up and what each one is about.'
    }
];

// How many projects the strip shows. Re-drawn at random on every page load, so the home page
// isn't the same five projects to a returning visitor - the showcase is where you go to see
// everything, this is a sample of it.
const FEATURED_COUNT = 5;

// Fisher-Yates. The old version spliced elements out of a copy inside a loop, which is the same
// idea written less directly - and it fell back to showing every project when there were fewer
// than three, rather than showing the ones it had.
function pickRandom(items, count) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
}

export default function HomePage() {
    const [featuredProjects, setFeaturedProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingProject, setViewingProject] = useState(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        const load = async () => {
            try {
                const cached = readCache(CACHE_KEYS.projects);
                const projects = !isStale(cached)
                    ? cached.data
                    : await revalidate(CACHE_KEYS.projects, getProjects);

                if (!isMounted.current) return;
                // Only projects the board itself shows. The old home page drew from every
                // document in the collection, so it could feature a project that the Projects
                // page - which has always filtered on `featured` - refused to list.
                setFeaturedProjects(pickRandom(projects.filter((project) => project.featured), FEATURED_COUNT));
            } catch (error) {
                console.error('Error loading featured projects:', error);
                if (isMounted.current) setFeaturedProjects([]);
            } finally {
                if (isMounted.current) setLoading(false);
            }
        };

        load();
        return () => { isMounted.current = false; };
    }, []);

    return (
        <>
            {/* Hero. Charcoal and full-bleed, with the wordmark centred across the whole band -
                no illustration, so the type carries the section on its own and can run large. */}
            <section className="bg-usb-charcoal px-6 sm:px-8 py-20 lg:py-28">
                <motion.div
                    // max-w-6xl, not 5xl: at the xl heading size the icon + wordmark lockup is
                    // just over 1024px, so a narrower column wraps the icon onto its own line.
                    className="max-w-6xl mx-auto text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    // Same timing as everything below it, so the page arrives as one thing
                    // rather than the hero landing first and the rest catching up.
                    transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
                >
                    {/* The icon sits inline with the wordmark and scales with it, so the pair
                        reads as one lockup at every breakpoint instead of a logo parked above a
                        heading. Its own artwork is a #333333 rounded square - the exact colour
                        of this section - so without a rule it reads as loose gold lettering
                        rather than a badge. The radius is a percentage because the source art's
                        corners are 16% of its box, so it stays matched as the icon scales. */}
                    <h1 className="font-body font-bold text-white text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-tight mb-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                        <img
                            src="/usb/usb-icon.webp"
                            alt=""
                            aria-hidden="true"
                            className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain shrink-0 rounded-[16%] border-2 border-usb-gold"
                            draggable={false}
                        />
                        <span>
                            Technical <span className="text-usb-gold">Projects</span>
                        </span>
                    </h1>
                    <p className="font-body text-lg sm:text-xl lg:text-2xl text-white/85 leading-relaxed mb-10 max-w-4xl mx-auto">
                        From innovative personal creations to award-winning hackathon entries, dive into a showcase
                        of what makes Purdue CS great. Get inspired, submit your own work, and explore the
                        creativity and technical excellence of the Purdue community.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button to="/projects" size="lg">
                            Explore the Showcase
                        </Button>
                        <Button to="/projects?post=1" variant="ghostLight" size="lg">
                            Submit Your Project
                        </Button>
                    </div>
                </motion.div>
            </section>

            {/* A sample of the showcase, scrolling past on its own. Deliberately not the whole
                board: this is a shop window, and /projects is where you go to browse properly.
                Full-bleed rather than inside a max-width column, so cards run off both edges
                and it reads as a strip that continues rather than a row that ended.

                It sits directly under the hero because the projects ARE the pitch - somebody
                landing here should see student work before they see a list of links, and the
                main site's gold diagonal is the strongest backdrop the page has to give it.

                The diagonal is drawn here rather than left to the page's own fixed backdrop:
                that one is pinned to the viewport, so its wedge slides across this band as you
                scroll. A local copy is anchored to the section, which means the split lands in
                the same place every time. */}
            <section className="relative overflow-hidden py-16">
                <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom right, #FFCA44 50%, #F8F7F3 50%)' }}
                />
                {/* z-10 so the absolute backdrop above doesn't paint over the content: a
                    positioned element outranks static siblings at the same stacking level. */}
                <div className="relative z-10">
                    <div className="px-6 sm:px-8">
                        <motion.h2
                            {...fadeUp()}
                            className="font-heading font-bold text-3xl lg:text-4xl text-usb-charcoal text-center mb-10"
                        >
                            Featured Projects
                        </motion.h2>
                    </div>

                    {loading ? (
                        <div className="text-center font-body font-semibold text-usb-muted py-20 animate-pulse">
                            Loading projects from the board...
                        </div>
                    ) : featuredProjects.length === 0 ? (
                        <div className="font-body text-lg text-usb-charcoal text-center leading-relaxed py-16 px-6">
                            No projects on the board yet.{' '}
                            <Link to="/projects?post=1" className="font-semibold underline">Be the first to post one.</Link>
                        </div>
                    ) : (
                        <>
                            <ProjectMarquee projects={featuredProjects} onView={setViewingProject} />

                            <div className="text-center mt-10 px-6">
                                {/* Charcoal rather than the outline: this now sits on the gold
                                    half of the wedge, where an outlined button all but vanishes. */}
                                <Button to="/projects" variant="darkGold">
                                    See the whole showcase
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* The same gold/surface wedge as the strip above, with the two colours swapped:
                white top-left, gold bottom-right, where the band above runs gold top-left to
                white bottom-right. Same two colours, same 45-degree motif, opposite order - no
                new colour and no divider rule.

                A rule was tried here and taken out again: it read as an applied line, and a gold
                one was invisible anyway wherever gold met gold along the seam.

                Ending in gold on the right also gives the band below a cleaner start - it meets
                the charcoal Connect band as a hard colour change. */}
            <section className="relative overflow-hidden py-16 px-6 sm:px-8">
                <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom right, #F8F7F3 50%, #FFCA44 50%)' }}
                />
                {/* z-10 so the absolute wedge doesn't paint over the content: a positioned
                    element outranks static siblings at the same stacking level. */}
                <div className="relative z-10 max-w-7xl mx-auto">
                    <motion.h2
                        {...fadeUp()}
                        className="font-heading font-bold text-3xl lg:text-4xl text-usb-charcoal text-center mb-10"
                    >
                        Where to Start
                    </motion.h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {startingPoints.map((item) => {
                            const Icon = item.icon;
                            // fadeUp() with no index: the four are one row and should land
                            // together, like the rest of the page.
                            return (
                                <motion.div key={item.to} {...fadeUp()}>
                                    <Link
                                        to={item.to}
                                        className="group flex flex-col h-full bg-white border border-usb-border rounded-2xl shadow-md p-6 no-underline transition-shadow duration-200 hover:shadow-xl"
                                    >
                                        <div className="w-12 h-12 mb-4 bg-usb-gold rounded-lg flex items-center justify-center text-usb-charcoal">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-heading font-bold text-xl text-usb-charcoal mb-2">
                                            <span className="relative">
                                                {item.title}
                                                <UnderlineSwipe color="charcoal" />
                                            </span>
                                        </h3>
                                        <p className="font-body text-usb-charcoal leading-relaxed">{item.body}</p>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Connect band, on charcoal like the main site's "Stay Connected" section. The page
                alternates the whole way down - charcoal hero, gold wedge, sand, charcoal, gold
                footer - so every boundary is a real colour change and not one divider line.

                Animates on mount with everything else, not whileInView. Scroll-triggered was
                the wrong call here: the band sits below the fold, so it stayed at opacity 0
                until you happened to scroll far enough, which reads as the page still loading
                rather than as a reveal. */}
            <motion.section
                className="bg-usb-charcoal px-6 sm:px-8 py-16"
                {...fadeUp()}
            >
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="font-heading font-bold text-3xl text-white mb-4">Connect with USB</h2>
                    <p className="font-body text-lg text-white/80 leading-relaxed mb-8">
                        Want to get involved, or have a question about the board? Check out our Instagram and
                        website for more about Purdue USB.
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4">
                        <a
                            href="https://purdueusb.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-2 font-body font-semibold text-lg text-usb-gold no-underline"
                        >
                            <Globe className="w-6 h-6 shrink-0" />
                            <span className="relative">
                                USB Website
                                <UnderlineSwipe color="gold" />
                            </span>
                        </a>
                        <a
                            href="https://www.instagram.com/purdueusb/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-2 font-body font-semibold text-lg text-usb-gold no-underline"
                        >
                            <Camera className="w-6 h-6 shrink-0" />
                            <span className="relative">
                                USB Instagram
                                <UnderlineSwipe color="gold" />
                            </span>
                        </a>
                    </div>
                </div>
            </motion.section>

            <ProjectDetailModal project={viewingProject} onClose={() => setViewingProject(null)} />
        </>
    );
}
