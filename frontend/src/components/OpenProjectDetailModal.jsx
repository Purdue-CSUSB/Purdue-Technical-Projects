import { Pencil, Trash2, Mail, Users, Clock, UsersRound, ExternalLink } from 'lucide-react';
import ModalShell from './ui/ModalShell.jsx';
import Button from './ui/Button.jsx';
import { buildMailto, isExpired } from '../lib/openProjectFields.js';
import { getCategoryLabel } from '../lib/projectFields.js';

// The full listing, for when a card's clamped text isn't the whole story. Cards are a fixed
// height so the grid stays even; this is where the untruncated version lives.

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

const Fact = ({ icon, label, value }) => (
  <div className="bg-white border border-usb-rule rounded-lg p-3 min-w-0">
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-usb-muted shrink-0">{icon}</span>
      <span className="font-heading text-[11px] font-bold uppercase tracking-wide text-usb-muted">{label}</span>
    </div>
    <p className="font-body text-sm font-semibold text-usb-charcoal break-words">{value || '—'}</p>
  </div>
);

export default function OpenProjectDetailModal({ project, canManage = false, onClose, onEdit, onDelete }) {
  if (!project) return null;

  const mailtoLink = buildMailto(project);
  const techStack = project.techStack ?? [];
  const expired = isExpired(project);

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
          <h2 className="font-heading font-bold text-2xl text-usb-charcoal break-words">{project.title}</h2>
          <p className="font-body text-sm text-usb-muted mt-1">
            Led by <span className="font-semibold text-usb-charcoal">{project.manager}</span>
            {project.deadline && (
              <>
                {/* Sized up from the surrounding text - at the body size a middot reads as a
                    speck rather than a separator. */}
                <span aria-hidden="true" className="mx-2 text-xl leading-none align-middle text-usb-muted">·</span>
                <span className="font-semibold text-usb-charcoal">
                  {expired ? `Closed ${project.deadline}` : `Accepting until ${project.deadline}`}
                </span>
              </>
            )}
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
        <Section title="About This Project" first>
          {project.description}
        </Section>

        {project.requirements && (
          <Section title="Requirements">{project.requirements}</Section>
        )}

        {techStack.length > 0 && (
          <Section title="Tech Stack">
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => (
                <span key={tech} className="px-3 py-1 bg-gray-100 border border-usb-rule font-body text-sm rounded-full text-usb-charcoal break-words">
                  {tech}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section title="At A Glance">
          <div className="bg-usb-zebra border border-usb-rule border-l-4 border-l-usb-gold rounded-lg p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fact icon={<Users className="w-3.5 h-3.5" />} label="Roles Needed" value={project.rolesNeeded} />
              <Fact icon={<Clock className="w-3.5 h-3.5" />} label="Time (Weekly)" value={project.timeCommitment} />
              <Fact icon={<UsersRound className="w-3.5 h-3.5" />} label="Current Team" value={project.teamSize} />
              <Fact icon={<Mail className="w-3.5 h-3.5" />} label="Contact" value={project.contactEmail} />
            </div>
          </div>
        </Section>

        {project.repoUrl && (
          <Section title="Project Link">
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-usb-charcoal underline hover:text-black break-all"
            >
              {project.repoUrl}
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>
          </Section>
        )}

        <Section title="Type">{getCategoryLabel(project.category_id)}</Section>
      </div>

      {/* lift={false} throughout: in a row of controls, one that lifts off the surface reads as
          the only clickable one. They all just change colour instead. */}
      <div className="p-5 sm:p-6 flex flex-wrap justify-between items-center gap-3 border-t border-usb-rule shrink-0 bg-white">
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button variant="ghost" size="sm" lift={false} onClick={() => onEdit(project)}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" lift={false} onClick={() => onDelete(project)}>
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          )}
        </div>
        {mailtoLink && (
          <Button href={mailtoLink} size="sm" lift="subtle">
            Email to Join
          </Button>
        )}
      </div>
    </ModalShell>
  );
}
