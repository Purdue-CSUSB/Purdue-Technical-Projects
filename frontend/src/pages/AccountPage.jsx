import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Trash2, Users } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/useAuth.js';
import { OPEN_PROJECT_LIMIT, SHOWCASE_LIMIT } from '../config.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import ResultModal from '../components/ResultModal.jsx';
import Button from '../components/ui/Button.jsx';
import PageHeader, { PageShell } from '../components/ui/PageHeader.jsx';
import { fadeUp } from '../components/ui/motion.js';
import { CACHE_KEYS, isStale, readCache, revalidate, writeCache } from '../lib/apiCache.js';
import { getCategoryLabel, getStatusLabel, projectImageUrl } from '../lib/projectFields.js';
import { isExpired } from '../lib/openProjectFields.js';

// One page for everything the signed-in user owns, across both boards. The two lists are kept
// visually distinct because they are different things: a showcase entry is a permanent record
// of finished work, an open listing is a live recruiting post that gets taken down when the
// team fills up.

function CountPill({ used, limit }) {
  const full = used >= limit;
  return (
    <span
      className={`font-body text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap ${
        full ? 'bg-usb-charcoal text-usb-gold' : 'bg-usb-gold text-usb-charcoal'
      }`}
    >
      {used} of {limit}
    </span>
  );
}

// Rows arrive one after another rather than all at once. The delay is small and capped, so a
// long list still finishes quickly instead of trickling in for seconds.
function Row({ index = 0, children }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ duration: 0.32, ease: 'easeOut', delay: Math.min(index * 0.06, 0.4) }}
      className="flex items-center gap-4 p-4 bg-white border border-usb-border rounded-xl"
    >
      {children}
    </motion.li>
  );
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, authFetch } = useAuth();

  const showcaseKey = CACHE_KEYS.myProjects(user?.email);
  const openKey = CACHE_KEYS.myOpenProjects(user?.email);

  const [showcase, setShowcase] = useState(() => readCache(showcaseKey)?.data ?? []);
  const [open, setOpen] = useState(() => readCache(openKey)?.data ?? []);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [result, setResult] = useState(null);

  // A signed-out visitor has nothing to see here. Redirect rather than render an empty shell.
  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true, state: { from: '/account' } });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const load = async (key, url, setter) => {
      const cached = readCache(key);
      if (cached) setter(cached.data);
      if (!isStale(cached)) return cached.data;

      const data = await revalidate(key, async () => {
        const response = await authFetch(url);
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || 'Failed to load.');
        return body;
      });
      if (!cancelled) setter(data);
      return data;
    };

    Promise.all([
      load(showcaseKey, '/api/projects/mine', setShowcase),
      load(openKey, '/api/open-projects/mine', setOpen)
    ])
      .catch((error) => console.error('Failed to load your posts:', error))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [isAuthenticated, authFetch, showcaseKey, openKey]);

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;

    const isShowcase = target.kind === 'showcase';
    const url = isShowcase ? `/api/projects/${target.project._id}` : `/api/open-projects/${target.project._id}`;
    const listKey = isShowcase ? showcaseKey : openKey;
    const boardKey = isShowcase ? CACHE_KEYS.projects : CACHE_KEYS.openProjects;
    const setter = isShowcase ? setShowcase : setOpen;
    const previous = isShowcase ? showcase : open;

    // Optimistic: drop it from this page and from the cached public board, so navigating there
    // doesn't show a card that has already been deleted.
    const remaining = previous.filter((p) => p._id !== target.project._id);
    setter(remaining);
    writeCache(listKey, remaining);
    const cachedBoard = readCache(boardKey);
    if (cachedBoard) {
      writeCache(boardKey, cachedBoard.data.filter((p) => p._id !== target.project._id));
    }

    try {
      const response = await authFetch(url, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete.');
      }
    } catch (error) {
      console.error('Delete Error:', error);
      setter(previous);
      writeCache(listKey, previous);
      if (cachedBoard) writeCache(boardKey, cachedBoard.data);
      setResult({ type: 'error', title: 'Delete Failed', message: error.message || 'Failed to delete.' });
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Full-bleed charcoal, matching the Research Resources account page - and the auth
          pages, which are the site's other signed-in-only screens, so the three read as one
          area. flex-1 fills down to the footer rather than ending under the content. */}
      <PageShell width="max-w-4xl" className="flex-1 bg-usb-charcoal">
        <PageHeader onDark title="Your" accent="Account" />

        <motion.div {...fadeUp(0, 0.1)} className="bg-white border border-usb-border rounded-2xl shadow-md p-6 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-heading font-bold text-xl text-usb-charcoal break-words">{user.username}</p>
              <p className="font-body text-sm text-usb-muted break-words">{user.email}</p>
              {user.isAdmin && (
                <span className="inline-block mt-2 font-body text-xs font-semibold px-2 py-1 rounded-md bg-usb-charcoal text-usb-gold">
                  Admin
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" lift={false} onClick={() => { logout(); navigate('/'); }}>
              Log Out
            </Button>
          </div>
        </motion.div>

        {/* mode="wait" holds the incoming block until the spinner has faded out, so the two
            never overlap and the content arrives on a settled page rather than punching in
            the instant the request resolves. */}
        <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="text-center font-body font-semibold text-white/70 py-16 animate-pulse"
          >
            Loading your projects...
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="space-y-10"
          >
            {/* --- Showcase ------------------------------------------------------------- */}
            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-heading font-bold text-2xl text-white">Showcase Projects</h2>
                <CountPill used={showcase.length} limit={SHOWCASE_LIMIT} />
              </div>

              {showcase.length === 0 ? (
                <div className="font-body text-usb-charcoal bg-white border border-usb-border rounded-xl p-6">
                  You haven't posted any finished projects yet.{' '}
                  <Link to="/projects?post=1" className="font-semibold underline">Post one</Link>.
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {showcase.map((project, index) => (
                      <Row key={project._id} index={index}>
                        <div className="w-14 h-14 shrink-0 rounded-lg bg-usb-zebra border border-usb-rule overflow-hidden flex items-center justify-center">
                          <img
                            src={projectImageUrl(project)}
                            alt=""
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-body font-semibold text-usb-charcoal truncate" title={project.name}>
                            {project.name}
                          </p>
                          <p className="font-body text-xs text-usb-muted truncate">
                            {getCategoryLabel(project.category_id)} · {getStatusLabel(project.status)}
                          </p>
                        </div>
                        <a
                          href={project.links}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Visit ${project.name}`}
                          className="shrink-0 p-2 rounded-lg text-usb-muted hover:text-usb-charcoal transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          lift={false}
                          className="shrink-0"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => setPendingDelete({ kind: 'showcase', project })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </Row>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>

            {/* --- Open listings -------------------------------------------------------- */}
            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-heading font-bold text-2xl text-white">Open Projects</h2>
                <CountPill used={open.length} limit={OPEN_PROJECT_LIMIT} />
              </div>

              {open.length === 0 ? (
                <div className="font-body text-usb-charcoal bg-white border border-usb-border rounded-xl p-6">
                  You don't have any projects looking for teammates.{' '}
                  <Link to="/open-projects" className="font-semibold underline">Post one</Link>.
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {open.map((project, index) => (
                      <Row key={project._id} index={index}>
                        <span className="w-14 h-14 shrink-0 rounded-lg bg-usb-gold text-usb-charcoal flex items-center justify-center">
                          <Users className="w-5 h-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-body font-semibold text-usb-charcoal truncate" title={project.title}>
                            {project.title}
                          </p>
                          <p className="font-body text-xs text-usb-muted truncate">
                            {project.rolesNeeded}
                            {project.deadline && ` · ${isExpired(project) ? 'closed' : 'until'} ${project.deadline}`}
                          </p>
                        </div>
                        {/* Editing lives on the board, where the full form modal already is -
                            duplicating it here would be a second copy to keep in step. */}
                        <Button
                          to="/open-projects"
                          variant="ghost"
                          size="sm"
                          lift={false}
                          className="shrink-0 hidden sm:inline-flex"
                        >
                          Manage
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          lift={false}
                          className="shrink-0"
                          aria-label={`Delete ${project.title}`}
                          onClick={() => setPendingDelete({ kind: 'open', project })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </Row>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          </motion.div>
        )}
        </AnimatePresence>
      </PageShell>

      <ConfirmModal
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'open' ? 'Take This Listing Down?' : 'Delete This Project?'}
        message="This will permanently remove it. This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ResultModal result={result} onClose={() => setResult(null)} />
    </>
  );
}
