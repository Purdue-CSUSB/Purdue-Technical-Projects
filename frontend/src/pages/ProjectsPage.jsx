import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/useAuth.js';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectDetailModal from '../components/ProjectDetailModal.jsx';
import ProjectFormModal from '../components/ProjectFormModal.jsx';
import ResultModal from '../components/ResultModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Button from '../components/ui/Button.jsx';
import PageHeader, { PageShell } from '../components/ui/PageHeader.jsx';
import { fadeUp } from '../components/ui/motion.js';
import { PROJECT_CATEGORIES, SHOWCASE_LIMIT } from '../config.js';
import { getProjects, submitProject, updateProject } from '../services/api.js';
import { CACHE_KEYS, isStale, readCache, revalidate, writeCache } from '../lib/apiCache.js';

const ALL = 'all';
const filters = [{ value: ALL, label: 'All Projects' }, ...PROJECT_CATEGORIES];

// Links elsewhere (the home page's hero, the account page's empty state) point at
// /projects?post=1 so they land here with the form already open, rather than dropping somebody
// on the board and leaving them to find the button.
const POST_PARAM = 'post';

export default function ProjectsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuthenticated, isAdmin, user, authFetch } = useAuth();
    const myKey = CACHE_KEYS.myProjects(user?.email);

    // Seed from the cache so returning to the board renders the previous list on the first
    // paint instead of flashing a spinner and re-querying the database.
    const [projects, setProjects] = useState(() => readCache(CACHE_KEYS.projects)?.data ?? []);
    // Only ever spins when there is nothing to show. A cached-but-stale board still renders
    // straight away and the refetch below happens quietly underneath it.
    const [loading, setLoading] = useState(() => !readCache(CACHE_KEYS.projects));
    const [selectedCategory, setSelectedCategory] = useState(ALL);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingProject, setViewingProject] = useState(null);
    // null when closed; otherwise { mode: 'create' } or { mode: 'edit', project }. One piece of
    // state rather than an isOpen flag plus a separate "which project", which could disagree.
    const [formState, setFormState] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [result, setResult] = useState(null);

    // The caller's own posts: what the cap is measured against, and what says whether a given
    // card on the board is theirs to edit or remove.
    const [myProjects, setMyProjects] = useState(() => readCache(myKey)?.data ?? []);
    const atLimit = isAuthenticated && !isAdmin && myProjects.length >= SHOWCASE_LIMIT;

    // Admins can manage anything; everyone else only what they posted. The server enforces this
    // independently in api/projects/[id].js - hiding the buttons is a courtesy, not the control.
    const myIds = useMemo(() => new Set(myProjects.map((project) => project._id)), [myProjects]);
    const canManage = (project) => isAuthenticated && (isAdmin || myIds.has(project._id));

    // Keeps the public board, the caller's own list and both caches in step after an edit or a
    // delete, so returning to the board shows it as the user just left it.
    const applyChange = (updateList) => {
        setProjects((current) => {
            const next = updateList(current);
            writeCache(CACHE_KEYS.projects, next);
            return next;
        });
        setMyProjects((current) => {
            const next = updateList(current);
            writeCache(myKey, next);
            return next;
        });
    };

    useEffect(() => {
        if (!isStale(readCache(CACHE_KEYS.projects))) return;

        let cancelled = false;
        revalidate(CACHE_KEYS.projects, getProjects)
            .then((data) => { if (!cancelled) setProjects(data); })
            .catch((error) => console.error('Failed to load projects:', error))
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, []);

    const filteredProjects = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return projects.filter((project) => {
            // `featured` is what moderation now sets on an approved submission, so this is the
            // line between "on the board" and "not". Projects saved before the moderator
            // existed are only here if somebody flipped the flag by hand, which is unchanged.
            if (!project.featured) return false;
            if (selectedCategory !== ALL && project.category_id !== selectedCategory) return false;
            if (!query) return true;

            // Optional-chained throughout: a document written before a field existed would
            // otherwise throw here and blank the whole board rather than just missing a match.
            return (
                project.name?.toLowerCase().includes(query) ||
                project.description?.toLowerCase().includes(query) ||
                project.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
                project.members?.some((member) => member.toLowerCase().includes(query))
            );
        });
    }, [projects, selectedCategory, searchQuery]);

    const activeFilterLabel = filters.find((filter) => filter.value === selectedCategory)?.label ?? 'Projects';

    // Load the caller's own posts, so the cap is known before they open the form.
    useEffect(() => {
        if (!isAuthenticated) {
            setMyProjects([]);
            return;
        }

        const cached = readCache(myKey);
        if (cached) setMyProjects(cached.data);
        if (!isStale(cached)) return;

        let cancelled = false;
        revalidate(myKey, async () => {
            const response = await authFetch('/api/projects/mine');
            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || 'Failed to load your projects.');
            return data;
        })
            .then((data) => { if (!cancelled) setMyProjects(data); })
            .catch((error) => console.error('Failed to load your projects:', error));

        return () => { cancelled = true; };
    }, [isAuthenticated, authFetch, myKey]);

    const openForm = () => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: '/projects?post=1' } });
            return;
        }
        // Explain the cap on click rather than disabling the button. A greyed-out control tells
        // you that you can't, but not why or what to do about it.
        if (atLimit) {
            setResult({
                type: 'error',
                title: 'Project Limit Reached',
                message: `You've posted the maximum of ${SHOWCASE_LIMIT} projects. Delete one from your account to post another.`
            });
            return;
        }
        setFormState({ mode: 'create' });
    };

    // The cap is a limit on posting, not on fixing what you already posted, so editing is never
    // gated on it the way openForm is.
    const handleOpenEdit = (project) => {
        setViewingProject(null);
        setFormState({ mode: 'edit', project });
    };

    const handleRequestDelete = (project) => setPendingDelete(project);

    const confirmDelete = async () => {
        const project = pendingDelete;
        setPendingDelete(null);
        if (!project) return;

        // Remove it from the board straight away rather than after the round trip. A cold
        // serverless function can take a second, and waiting on it before starting the
        // animation leaves the user staring at the card they just confirmed away.
        const previousAll = projects;
        const previousMine = myProjects;
        applyChange((list) => list.filter((p) => p._id !== project._id));
        setViewingProject((current) => (current && current._id === project._id ? null : current));

        try {
            const response = await authFetch(`/api/projects/${project._id}`, { method: 'DELETE' });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to remove project.');
            }
        } catch (error) {
            console.error('Delete Error:', error);
            // The delete didn't happen, so put the project back exactly where it was.
            setProjects(previousAll);
            writeCache(CACHE_KEYS.projects, previousAll);
            setMyProjects(previousMine);
            writeCache(myKey, previousMine);
            setResult({
                type: 'error',
                title: 'Delete Failed',
                message: error.message || 'Failed to remove project.'
            });
        }
    };

    // Honour ?post=1 once, then strip it: without that, a refresh (or a back-navigation) would
    // reopen a form the user had already closed.
    useEffect(() => {
        if (!searchParams.has(POST_PARAM)) return;
        const next = new URLSearchParams(searchParams);
        next.delete(POST_PARAM);
        setSearchParams(next, { replace: true });
        openForm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, isAuthenticated, atLimit]);

    const handleSubmit = async (formData) => {
        const isEdit = formState?.mode === 'edit';
        const editing = formState?.project;
        setIsSubmitting(true);

        try {
            const saved = isEdit
                ? await updateProject(authFetch, editing._id, formData)
                : await submitProject(authFetch, formData);

            // Splice the saved document straight into the board and the cache, so the change is
            // on screen the moment the dialog closes rather than after the cache's minute
            // lapses. The API echoes it back specifically so this has the real _id to render an
            // <img src="/api/projects/:id/image"> against.
            if (saved?.project) {
                if (isEdit) {
                    applyChange((list) =>
                        list.map((p) => (p._id === saved.project._id ? { ...p, ...saved.project } : p))
                    );
                } else {
                    applyChange((list) => [saved.project, ...list]);
                }
            }

            setFormState(null);
            setResult(
                isEdit
                    ? {
                        type: 'success',
                        title: 'Project Updated',
                        message: 'Your changes passed review and are live on the showcase.'
                    }
                    : {
                        type: 'success',
                        title: 'Project Posted!',
                        message: 'Your project passed review and is now live on the showcase.'
                    }
            );
        } catch (error) {
            // A moderation rejection is the submitter's to fix and deserves an explanation.
            // Anything else is ours, and the API's own message is the more useful one.
            const message = error.stage === 'moderation'
                ? `Your ${isEdit ? 'changes didn’t' : 'project didn’t'} pass our automated review. Please make sure it's a real, specific project with a clear description, then try again.`
                : (error.message || 'Something went wrong. Please try again.');

            setResult({
                type: 'error',
                title: error.stage === 'moderation'
                    ? (isEdit ? 'Changes Not Approved' : 'Submission Not Approved')
                    : error.stage === 'limit' ? 'Project Limit Reached' : 'Something Went Wrong',
                message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <PageShell width="max-w-4xl" className="!pb-2">
                <PageHeader
                    title="Purdue Student"
                    accent="Projects"
                    lead="Explore what Purdue students have built - from personal side projects to class work to hackathon winners. Every project here was posted by the people who made it."
                    className="mb-8"
                />

                {/* Search and "Post a Project" are one control row, not a CTA parked above the
                    page. Posting is a thing you do TO this board, so it belongs with the board's
                    other controls - and at the same height and radius as the search field it
                    reads as part of the furniture rather than an advert for itself. The row is
                    the width of the two together, so nothing is centred against nothing. */}
                <motion.div {...fadeUp(0, 0.15)} className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
                    <div className="relative flex-1 min-w-0">
                        <label htmlFor="project-search" className="sr-only">Search projects</label>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-usb-muted pointer-events-none" />
                        <input
                            id="project-search"
                            type="search"
                            placeholder="Search by name, tag, member or keyword..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-usb-border bg-white pl-12 pr-4 py-3 font-body text-base text-usb-charcoal placeholder:text-usb-muted outline-none transition-colors duration-200 focus:border-usb-gold focus:ring-2 focus:ring-usb-gold/40"
                        />
                    </div>
                    {/* Charcoal, matching the selected filter chip below: this row sits where the
                        backdrop's gold wedge falls, and a gold button would blend into it.
                        py-3 to match the input's height exactly, so the row has one baseline. */}
                    <Button
                        variant="darkGold"
                        onClick={openForm}
                        className="shrink-0 !py-3"
                        title={isAuthenticated ? 'Post a project to the showcase' : 'Log in to post a project'}
                    >
                        <Plus className="w-4 h-4" />
                        Post a Project
                    </Button>
                </motion.div>

                <motion.div {...fadeUp(1, 0.15)} className="flex flex-wrap justify-center gap-3 mt-6">
                    {filters.map((filter) => {
                        const isSelected = selectedCategory === filter.value;
                        return (
                            <Button
                                key={filter.value}
                                // Charcoal for the selected chip rather than gold: this row sits
                                // where the backdrop's gold wedge falls, so a gold chip blends
                                // into it exactly where it most needs to stand out.
                                variant={isSelected ? 'darkGold' : 'ghost'}
                                size="sm"
                                lift={isSelected ? 'subtle' : false}
                                aria-pressed={isSelected}
                                onClick={() => setSelectedCategory(filter.value)}
                            >
                                {filter.label}
                            </Button>
                        );
                    })}
                </motion.div>
            </PageShell>

            <section className="px-6 sm:px-8 pt-8 pb-16">
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="text-center font-body font-semibold text-usb-muted py-20 animate-pulse">
                            Loading projects from the board...
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        // Same treatment as the lead paragraph under the page title, so an empty
                        // board reads as part of the page rather than a greyed-out system message.
                        // Same treatment as the lead paragraph under the page title, so an empty
                        // board reads as part of the page rather than a greyed-out system message.
                        // No button here: the one in the control row above is still on screen.
                        <div className="font-body text-lg text-usb-charcoal text-center leading-relaxed py-20">
                            {searchQuery.trim()
                                ? `No projects match "${searchQuery.trim()}".`
                                : selectedCategory === ALL
                                    ? 'No projects on the board yet. Be the first to post one!'
                                    : `No ${activeFilterLabel.toLowerCase()} on the board yet.`}
                        </div>
                    ) : (
                        // Two across, not three: the cards are landscape now, and a third column
                        // squeezes the text panel beside the image down to almost nothing.
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* popLayout takes a filtered-out card out of flow as it fades, so
                                the cards after it reflow into the gap smoothly rather than
                                jumping the moment it's removed. */}
                            <AnimatePresence mode="popLayout">
                                {filteredProjects.map((project, index) => (
                                    <ProjectCard
                                        key={project._id}
                                        project={project}
                                        index={index}
                                        canManage={canManage(project)}
                                        onView={setViewingProject}
                                        onEdit={handleOpenEdit}
                                        onDelete={handleRequestDelete}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </section>

            <ProjectDetailModal
                project={viewingProject}
                canManage={viewingProject ? canManage(viewingProject) : false}
                onClose={() => setViewingProject(null)}
                onEdit={handleOpenEdit}
                onDelete={handleRequestDelete}
            />

            <ProjectFormModal
                open={formState !== null}
                mode={formState?.mode ?? 'create'}
                project={formState?.project ?? null}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onClose={() => setFormState(null)}
            />

            <ResultModal result={result} onClose={() => setResult(null)} />

            <ConfirmModal
                open={pendingDelete !== null}
                title="Delete This Project?"
                message="This will permanently remove it from the showcase. This can't be undone."
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </>
    );
}
