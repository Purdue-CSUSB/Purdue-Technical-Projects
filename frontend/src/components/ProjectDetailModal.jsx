import { useState } from 'react';
import { ExternalLink, Users, FolderOpen, Activity, Pencil, Trash2 } from 'lucide-react';
import ModalShell from './ui/ModalShell.jsx';
import Button from './ui/Button.jsx';
import { getCategoryLabel, getStatusLabel, projectImageUrl } from '../lib/projectFields.js';

// The full project, for when a card's clamped text isn't the whole story. Cards are a fixed
// height so the grid stays even; this is where the untruncated version lives - and where the
// image is shown at a size worth looking at.

// Each block gets a bold heading and a divider from the block above, so the description, the
// tags and the facts don't read as one continuous run of text.
const Section = ({ title, children, first = false }) => (
  <section className={first ? '' : 'border-t border-usb-rule pt-6'}>
    {/* inline-block so the gold rule stops at the end of the words rather than running the full
        width, where it would read as another divider instead of part of the heading. */}
    <h3 className="inline-block font-heading font-bold text-base text-usb-charcoal border-b-2 border-usb-gold pb-1 mb-3">
      {title}
    </h3>
    <div className="font-body text-usb-charcoal leading-relaxed whitespace-pre-wrap break-words">
      {children}
    </div>
  </section>
);

// The at-a-glance facts are short values, so they read better as labelled tiles than as more
// paragraphs - it also keeps them visually distinct from the prose above.
const Fact = ({ icon, label, value }) => (
  <div className="bg-white border border-usb-rule rounded-lg p-3 min-w-0">
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-usb-muted shrink-0">{icon}</span>
      <span className="font-heading text-[11px] font-bold uppercase tracking-wide text-usb-muted">{label}</span>
    </div>
    <p className="font-body text-sm font-semibold text-usb-charcoal break-words">{value || '—'}</p>
  </div>
);

export default function ProjectDetailModal({ project, canManage = false, onClose, onEdit, onDelete }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!project) return null;

  const tags = project.tags ?? [];
  const members = project.members ?? [];

  return (
    <ModalShell
      open={Boolean(project)}
      onDismiss={onClose}
      panelClassName="max-w-2xl border border-usb-border overflow-hidden flex flex-col max-h-[85vh]"
    >
      {/* Gold and full width, so the header reads as its own band. The section headings below
          use short, text-width gold rules, which stay subordinate to this one. */}
      <div className="p-5 sm:p-6 border-b-2 border-usb-gold flex justify-between items-start gap-4 shrink-0">
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-2xl text-usb-charcoal break-words">{project.name}</h2>
          <p className="font-body text-sm text-usb-muted mt-1">
            {getCategoryLabel(project.category_id)}
            {/* Sized up from the surrounding text - at the body size a middot reads as a speck
                rather than a separator. */}
            <span aria-hidden="true" className="mx-2 text-xl leading-none align-middle text-usb-muted">·</span>
            <span className="font-semibold text-usb-charcoal">{getStatusLabel(project.status)}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-usb-muted hover:text-usb-charcoal transition-colors cursor-pointer text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
        {!imageFailed && (
          <div className="rounded-xl bg-usb-zebra border border-usb-rule overflow-hidden flex items-center justify-center max-h-80">
            <img
              src={projectImageUrl(project)}
              alt={project.name}
              className="max-w-full max-h-80 object-contain"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}

        <Section title="About This Project" first>
          {project.description}
        </Section>

        {tags.length > 0 && (
          <Section title="Tags">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-gray-100 border border-usb-rule font-body text-sm rounded-full text-usb-charcoal break-words">
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section title="At A Glance">
          <div className="bg-usb-zebra border border-usb-rule border-l-4 border-l-usb-gold rounded-lg p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fact
                icon={<Users className="w-3.5 h-3.5" />}
                label="Team"
                value={members.join(', ')}
              />
              <Fact
                icon={<FolderOpen className="w-3.5 h-3.5" />}
                label="Category"
                value={getCategoryLabel(project.category_id)}
              />
              <Fact
                icon={<Activity className="w-3.5 h-3.5" />}
                label="Status"
                value={getStatusLabel(project.status)}
              />
            </div>
          </div>
        </Section>
      </div>

      <div className="p-5 sm:p-6 flex justify-end gap-3 border-t border-usb-rule shrink-0 bg-white">
        {/* Left-aligned, away from Close and Visit: destructive and edit actions shouldn't sit
            under the thumb that's reaching for the safe button. */}
        {canManage && (
          <div className="mr-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              lift={false}
              onClick={() => onEdit(project)}
              title="Edit this project"
              aria-label={`Edit ${project.name}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              lift={false}
              onClick={() => onDelete(project)}
              title="Remove this project"
              aria-label={`Delete ${project.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
        <Button variant="neutral" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button href={project.links} target="_blank" rel="noopener noreferrer" size="sm" lift="subtle">
          Visit Project
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    </ModalShell>
  );
}
