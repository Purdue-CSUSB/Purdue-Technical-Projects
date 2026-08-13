import { Pencil, Trash2, Users } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import Button from './ui/Button.jsx';
import { CARD_HOVER_SHADOW, HOVER_TRANSITION } from './ui/motion.js';
import { buildMailto, isExpired } from '../lib/openProjectFields.js';
import { getCategoryLabel } from '../lib/projectFields.js';

// A project that is still being built and is looking for people. Visually a sibling of the
// showcase's ProjectCard, but it carries different information: no image (there is often
// nothing to screenshot yet), and the space that card gives to a screenshot goes here to the
// facts somebody deciding whether to apply actually needs - roles, hours, team size.
const CARD_HEIGHT = 'h-[30rem]';

const MAX_VISIBLE_TECH = 4;

// A stat in the card's summary panel. Muted micro-label over the value, rather than a
// colour-per-stat scheme - three accent colours in one small panel read as decoration.
const Stat = ({ label, value, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <span className="block font-heading text-[11px] font-bold uppercase tracking-wide text-usb-muted mb-0.5">{label}</span>
    <span className="block font-body text-sm font-semibold text-usb-charcoal truncate" title={value}>{value || '—'}</span>
  </div>
);

export default function OpenProjectCard({ project, index = 0, canManage = false, onView, onEdit, onDelete }) {
  const techStack = project.techStack ?? [];
  const visibleTech = techStack.slice(0, MAX_VISIBLE_TECH);
  const hiddenTechCount = techStack.length - visibleTech.length;
  const mailtoLink = buildMailto(project);
  const expired = isExpired(project);

  return (
    <motion.article
      // `layout` makes the remaining cards glide into place when one is removed, rather than
      // snapping; `exit` gives the deleted card time to fade first.
      layout
      className={`bg-white border border-usb-border rounded-2xl shadow-md p-6 pb-8 flex flex-col ${CARD_HEIGHT}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2, ease: 'easeInOut' } }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: (index % 6) * 0.05 }}
      whileHover={{ scale: 1.02, boxShadow: CARD_HOVER_SHADOW, transition: HOVER_TRANSITION }}
      style={{ willChange: 'transform, box-shadow' }}
    >
      {/* Fixed-height blocks throughout, so one long description can't overflow its box and
          print over whatever sits underneath it. */}
      <div className="flex justify-between items-start gap-2 mb-3 min-h-[3.5rem] shrink-0">
        <h2 className="min-w-0 font-heading font-bold text-xl text-usb-charcoal line-clamp-2" title={project.title}>
          {project.title}
        </h2>
        {project.deadline && (
          // A passed deadline is greyed rather than hidden: the listing may still be live, and
          // an out-of-date date is more informative than no date at all.
          <span
            className={`shrink-0 font-body text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap ${
              expired ? 'bg-white text-usb-muted border border-usb-border' : 'bg-usb-gold text-usb-charcoal'
            }`}
            title={expired ? 'This listing’s deadline has passed' : 'Accepting applications until this date'}
          >
            {expired ? 'Closed' : `Until ${project.deadline}`}
          </span>
        )}
      </div>

      <div className="h-[4.5rem] overflow-hidden mb-1 shrink-0">
        <p className="font-body text-sm text-usb-charcoal leading-relaxed line-clamp-3">
          {project.description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onView(project)}
        className="self-start mb-4 shrink-0 font-body text-sm font-semibold text-usb-charcoal underline hover:text-black cursor-pointer"
      >
        View details
      </button>

      <div className="mb-4 shrink-0">
        <h3 className="font-heading text-[11px] font-bold uppercase tracking-wide text-usb-muted mb-2">Tech Stack</h3>
        {/* items-start matters: this row has a fixed height so the card stays even, and a flex
            container defaults to align-items: stretch - which was blowing every chip up to the
            full row height regardless of its text. They now size to their content. */}
        <div className="flex flex-wrap items-center gap-1.5 h-7 overflow-hidden">
          {visibleTech.map((tech) => (
            <span key={tech} className="px-2.5 py-0.5 bg-gray-100 font-body text-[11px] leading-5 rounded-full text-usb-charcoal truncate max-w-[9rem]">
              {tech}
            </span>
          ))}
          {hiddenTechCount > 0 && (
            <span className="font-body text-[11px] leading-5 font-semibold text-usb-muted whitespace-nowrap">
              +{hiddenTechCount} more
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 bg-usb-zebra border border-usb-rule border-l-4 border-l-usb-gold p-3 rounded-lg">
        <Stat label="Roles Needed" value={project.rolesNeeded} />
        <Stat label="Time (Weekly)" value={project.timeCommitment} />
        <Stat label="Current Team" value={project.teamSize} />
        <Stat label="Type" value={getCategoryLabel(project.category_id)} />
      </div>

      {/* Absorbs the slack, so the footer sits on the bottom edge of every card. */}
      <div className="flex-grow" />

      <div className="border-t border-usb-rule pt-4 shrink-0 flex flex-col gap-3">
        <p className="flex items-center gap-1.5 font-body text-sm text-usb-muted truncate">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Led by <span className="font-semibold text-usb-charcoal">{project.manager}</span></span>
        </p>
        <div className="flex items-center gap-2">
          {/* A contained lift - enough to mark this as the primary action, well short of the
              jump the full-strength version gives it. */}
          {mailtoLink && (
            <Button href={mailtoLink} size="sm" lift="subtle" className="flex-grow">
              Email to Join
            </Button>
          )}
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                lift={false}
                onClick={() => onEdit(project)}
                title="Edit this listing"
                aria-label={`Edit ${project.title}`}
                className="shrink-0"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                lift={false}
                onClick={() => onDelete(project)}
                title="Take this listing down"
                aria-label={`Delete ${project.title}`}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
