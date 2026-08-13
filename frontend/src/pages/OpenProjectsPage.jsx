import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/useAuth.js';
import { OPEN_PROJECT_LIMIT } from '../config.js';
import OpenProjectCard from '../components/OpenProjectCard.jsx';
import OpenProjectDetailModal from '../components/OpenProjectDetailModal.jsx';
import OpenProjectFormModal from '../components/OpenProjectFormModal.jsx';
import ResultModal from '../components/ResultModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Button from '../components/ui/Button.jsx';
import PageHeader, { PageShell } from '../components/ui/PageHeader.jsx';
import { fadeUp } from '../components/ui/motion.js';
import { CACHE_KEYS, isStale, readCache, revalidate, writeCache } from '../lib/apiCache.js';

// The "looking for teammates" board. Its sibling, /projects, is the finished-work showcase.

export default function OpenProjectsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, user, authFetch } = useAuth();
  const myKey = CACHE_KEYS.myOpenProjects(user?.email);

  // null = closed. { mode: 'create' } or { mode: 'edit', project } while open.
  const [formState, setFormState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // Seed from the cache so returning to the board renders the previous list on the first paint
  // instead of flashing a spinner and re-querying the database.
  const [projects, setProjects] = useState(() => readCache(CACHE_KEYS.openProjects)?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => !readCache(CACHE_KEYS.openProjects));

  // The caller's own listings: both the cap count and how the board knows which cards to offer
  // Edit/Delete on. The public list omits userId, so ownership can't be read from it.
  const [myProjects, setMyProjects] = useState(() => readCache(myKey)?.data ?? []);
  const myIds = useMemo(() => new Set(myProjects.map((p) => p._id)), [myProjects]);
  const atLimit = isAuthenticated && !isAdmin && myProjects.length >= OPEN_PROJECT_LIMIT;

  const canManage = (project) => isAuthenticated && (isAdmin || myIds.has(project._id));

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
      const response = await authFetch('/api/open-projects/mine');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Failed to load your listings.');
      return data;
    })
      .then((data) => { if (!cancelled) setMyProjects(data); })
      .catch((error) => console.error('Failed to load your listings:', error));

    return () => { cancelled = true; };
  }, [isAuthenticated, authFetch, myKey]);

  useEffect(() => {
    if (!isStale(readCache(CACHE_KEYS.openProjects))) return;

    let cancelled = false;
    revalidate(CACHE_KEYS.openProjects, async () => {
      const response = await fetch('/api/open-projects');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Failed to load listings.');
      return data;
    })
      .then((data) => { if (!cancelled) setProjects(data); })
      .catch((error) => console.error('Failed to load listings:', error))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Keep both cached lists in step with a local change, so navigating away and back shows the
  // board as the user just left it rather than as it was before their edit.
  const applyChange = (updateList) => {
    setProjects((current) => {
      const next = updateList(current);
      writeCache(CACHE_KEYS.openProjects, next);
      return next;
    });
    setMyProjects((current) => {
      const next = updateList(current);
      writeCache(myKey, next);
      return next;
    });
  };

  const handleSubmit = async (formData) => {
    const isEdit = formState?.mode === 'edit';
    const editing = formState?.project;
    setIsSubmitting(true);

    try {
      const response = await authFetch(
        isEdit ? `/api/open-projects/${editing._id}` : '/api/open-projects',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }
      );

      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text || 'Failed to save listing.' };
      }

      if (!response.ok) {
        // Show a clean reason rather than the raw "[stage] details" string.
        const message = data.stage === 'moderation'
          ? "Your listing didn't pass our automated review. Please make sure it describes a real project and the kind of person you're looking for, then try again."
          : (data.message || 'Failed to save listing. Please try again.');
        setResult({
          type: 'error',
          title: data.stage === 'limit' ? 'Listing Limit Reached' : 'Listing Not Approved',
          message
        });
        return;
      }

      // Use the saved document the API echoes back rather than the raw form: it carries the
      // real _id and the server's normalised techStack array.
      const saved = data.project;

      if (isEdit) {
        applyChange((list) => list.map((p) => (p._id === saved._id ? { ...p, ...saved } : p)));
        setViewingProject((current) => (current && current._id === saved._id ? { ...current, ...saved } : current));
        setResult({ type: 'success', title: 'Listing Updated', message: 'Your changes are live on the board.' });
      } else {
        applyChange((list) => [saved, ...list]);
        setResult({
          type: 'success',
          title: 'Listing Posted!',
          message: 'Your project is now live and people can reach out to join.'
        });
      }

      setFormState(null);
    } catch (error) {
      console.error('Save Error:', error);
      setResult({
        type: 'error',
        title: 'Something Went Wrong',
        message: error.message || "We couldn't reach the server. Please check your connection and try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    const project = pendingDelete;
    setPendingDelete(null);
    if (!project) return;

    // Remove it from the board straight away rather than after the round trip. A cold
    // serverless function can take a second, and waiting on it before starting the animation
    // leaves the user staring at the card they just confirmed away.
    const previousAll = projects;
    const previousMine = myProjects;
    applyChange((list) => list.filter((p) => p._id !== project._id));
    setViewingProject((current) => (current && current._id === project._id ? null : current));

    try {
      const response = await authFetch(`/api/open-projects/${project._id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to remove listing.');
      }
    } catch (error) {
      console.error('Delete Error:', error);
      // The delete didn't happen, so put the listing back exactly where it was.
      setProjects(previousAll);
      writeCache(CACHE_KEYS.openProjects, previousAll);
      setMyProjects(previousMine);
      writeCache(myKey, previousMine);
      setResult({ type: 'error', title: 'Delete Failed', message: error.message || 'Failed to remove listing.' });
    }
  };

  const handleOpenCreate = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/open-projects' } });
      return;
    }
    // Explain the cap on click rather than disabling the button. A greyed-out control tells you
    // that you can't, but not why or what to do about it.
    if (atLimit) {
      setResult({
        type: 'error',
        title: 'Listing Limit Reached',
        message: (
          <>
            You've reached the {OPEN_PROJECT_LIMIT}-listing limit. Take one down from your{' '}
            <Link to="/account" className="font-semibold text-usb-charcoal underline">Account</Link>{' '}
            to post another.
          </>
        )
      });
      return;
    }
    setFormState({ mode: 'create' });
  };

  const handleOpenEdit = (project) => {
    setViewingProject(null);
    setFormState({ mode: 'edit', project });
  };

  const handleRequestDelete = (project) => {
    setViewingProject(null);
    setPendingDelete(project);
  };

  return (
    <>
      <PageShell width="max-w-4xl" className="!pb-2">
        <PageHeader
          title="Find a"
          accent="Team"
          lead="Projects Purdue students are building right now and want help with. Browse what's being made, check the tech stack, and reach out to the lead directly to join."
          className="mb-8"
        />
        <motion.div {...fadeUp(0, 0.15)} className="text-center">
          {/* Charcoal rather than gold: this CTA sits centred near the top of the page, which is
              where the backdrop's gold wedge falls, so a gold button blends into it. */}
          <Button variant="darkGold" onClick={handleOpenCreate}>
            {isAuthenticated ? 'Post a Project' : 'Log In to Post a Project'}
          </Button>
        </motion.div>
      </PageShell>

      <section className="px-6 sm:px-8 pt-12 pb-16">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="text-center font-body font-semibold text-usb-muted py-20 animate-pulse">
              Loading open projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="font-body text-lg text-usb-charcoal text-center leading-relaxed py-20">
              No open projects right now. Be the first to post one!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* popLayout takes the exiting card out of flow as it fades, so the cards after it
                  reflow into the gap smoothly rather than jumping the moment it's removed. */}
              <AnimatePresence mode="popLayout">
                {projects.map((project, index) => (
                  <OpenProjectCard
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

      <OpenProjectFormModal
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        project={formState?.project ?? null}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onClose={() => setFormState(null)}
      />

      <OpenProjectDetailModal
        project={viewingProject}
        canManage={viewingProject ? canManage(viewingProject) : false}
        onClose={() => setViewingProject(null)}
        onEdit={handleOpenEdit}
        onDelete={handleRequestDelete}
      />

      <ResultModal result={result} onClose={() => setResult(null)} />
      <ConfirmModal
        open={pendingDelete !== null}
        title="Take This Listing Down?"
        message="This will permanently remove it from the board. This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
