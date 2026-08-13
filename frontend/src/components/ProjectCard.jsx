import { useState } from 'react';
import { ExternalLink, Users } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import Button from './ui/Button.jsx';
import { CARD_HOVER_SHADOW, HOVER_TRANSITION } from './ui/motion.js';
import { getCategoryLabel, getStatusLabel, projectImageUrl } from '../lib/projectFields.js';

// Landscape rather than portrait: image on the left, everything else beside it. The tall
// stacked version worked in a grid but was badly wrong in the home page's scrolling strip - a
// 320x576 card is most of the viewport's height for something meant to slide past, and five of
// them in a row read as a column of billboards.
//
// Every card is still a FIXED height so a grid row can't be stretched by whichever description
// happens to be longest; overflow is clamped and the full text lives behind "View details".
const CARD_HEIGHT = 'h-64';

const MAX_VISIBLE_TAGS = 3;

// Projects posted before images were required have none, and a broken-image glyph on an
// otherwise finished card looks like a bug rather than an absence.
function ProjectImage({ project }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="w-40 sm:w-48 shrink-0 h-full bg-usb-zebra border-r border-usb-rule flex items-center justify-center overflow-hidden">
      {failed ? (
        <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-usb-muted text-center px-2">
          No image
        </span>
      ) : (
        <img
          src={projectImageUrl(project)}
          alt={project.name}
          // Cards below the fold shouldn't cost a request until they're scrolled to.
          loading="lazy"
          decoding="async"
          // contain, not cover: submissions are as often a logo or a screenshot as a photo, and
          // cropping either one to fill the panel cuts off the part that identifies the project.
          className="max-w-full max-h-full object-contain p-3"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function ProjectCard({ project, index = 0, onView }) {
  const tags = project.tags ?? [];
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = tags.length - visibleTags.length;
  const members = project.members ?? [];
  const isActive = project.status === 'active';

  return (
    <motion.article
      // `layout` makes the remaining cards glide into their new positions when the filters
      // change, instead of snapping.
      layout
      // p-0 + overflow-hidden so the image panel runs to the card's own rounded edge rather
      // than floating inside a padded box.
      className={`bg-white border border-usb-border rounded-2xl shadow-md overflow-hidden flex ${CARD_HEIGHT}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2, ease: 'easeInOut' } }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: (index % 6) * 0.05 }}
      whileHover={{ scale: 1.02, boxShadow: CARD_HOVER_SHADOW, transition: HOVER_TRANSITION }}
      style={{ willChange: 'transform, box-shadow' }}
    >
      <ProjectImage project={project} />

      {/* min-w-0 is what lets the truncate/line-clamp below actually bite: without it a flex
          child refuses to shrink under its content's intrinsic width. */}
      <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 shrink-0">
          <h2 className="min-w-0 font-heading font-bold text-lg text-usb-charcoal line-clamp-1" title={project.name}>
            {project.name}
          </h2>
          {/* Gold for a live project, outlined for a finished one. */}
          <span
            className={`shrink-0 font-body text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${
              isActive
                ? 'bg-usb-gold text-usb-charcoal'
                : 'bg-white text-usb-muted border border-usb-border'
            }`}
          >
            {getStatusLabel(project.status)}
          </span>
        </div>

        <p className="mt-2 h-10 overflow-hidden font-body text-sm text-usb-charcoal leading-snug line-clamp-2 shrink-0">
          {project.description}
        </p>

        <button
          type="button"
          onClick={() => onView(project)}
          className="self-start mt-2.5 shrink-0 font-body text-sm font-semibold text-usb-charcoal underline hover:text-black cursor-pointer"
        >
          View details
        </button>

        {/* items-start: the row is a fixed height so cards stay even, and a flex container defaults
            to align-items: stretch, which was inflating every chip to the full row height. */}
        <div className="flex flex-wrap items-center gap-1.5 h-7 overflow-hidden mt-3.5 shrink-0">
          {visibleTags.map((tag) => (
            <span key={tag} className="px-2.5 py-0.5 bg-gray-100 font-body text-[11px] leading-5 rounded-full text-usb-charcoal truncate max-w-[9rem]">
              {tag}
            </span>
          ))}
          {hiddenTagCount > 0 && (
            <span className="font-body text-[11px] leading-5 font-semibold text-usb-muted whitespace-nowrap">
              +{hiddenTagCount} more
            </span>
          )}
        </div>

        {/* Absorbs whatever slack is left, so the footer sits on the bottom edge of every card. */}
        <div className="flex-grow" />

        <div className="border-t border-usb-rule pt-3 shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-body text-xs text-usb-muted truncate" title={members.join(', ')}>
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{members.join(', ') || 'Team not listed'}</span>
            </p>
            <span className="block font-heading text-[10px] font-bold uppercase tracking-wide text-usb-muted mt-0.5">
              {getCategoryLabel(project.category_id)}
            </span>
          </div>
          <Button href={project.links} target="_blank" rel="noopener noreferrer" size="sm" lift="subtle" className="shrink-0">
            Visit
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
