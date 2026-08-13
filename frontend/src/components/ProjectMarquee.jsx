import { useMemo } from 'react';
import ProjectCard from './ProjectCard.jsx';

// A strip of projects that scrolls past on its own, for the home page. The showcase board is
// where somebody goes to actually look through everything; this is a shop window.
//
// The mechanics live in index.css (@keyframes ptp-marquee). What matters here is that the track
// renders the sequence TWICE: the animation slides it exactly -50%, so as the first copy
// finishes leaving, the second is exactly where the first started and the loop is seamless.

// Seconds each card takes to cross. Multiplied by the card count, so five projects scroll at
// the same apparent speed as three rather than five times faster. Scaled up with the cards when
// they went landscape - a wider card travels further, so holding the per-card time fixed would
// have sped the strip up by half.
const SECONDS_PER_CARD = 13;

// With only one or two projects the sequence is narrower than the viewport, which would leave a
// visible gap before the second copy arrives. Repeating the base list up to this length fills
// the strip; the two-copy structure the animation depends on is unaffected.
const MIN_SEQUENCE = 4;

export default function ProjectMarquee({ projects, onView }) {
  const { sequence, duration } = useMemo(() => {
    if (projects.length === 0) return { sequence: [], duration: 0 };

    const base = [];
    while (base.length < MIN_SEQUENCE) base.push(...projects);

    return { sequence: base, duration: base.length * SECONDS_PER_CARD };
  }, [projects]);

  if (sequence.length === 0) return null;

  return (
    // overflow-x-auto rather than hidden: with prefers-reduced-motion the animation is off, and
    // this is what keeps the rest of the strip reachable by scrolling instead of unreachable.
    // The edge fade is a mask on this element - see .marquee in index.css.
    <div className="marquee relative overflow-x-auto">
      <div
        className="marquee-track flex w-max gap-8 py-2"
        style={{ '--marquee-duration': `${duration}s` }}
      >
        {sequence.map((project, index) => (
          <div key={`a-${project._id}-${index}`} className="w-[30rem] max-w-[85vw] shrink-0">
            {/* index 0, not the loop index: ProjectCard staggers its mount by index, and a
                strip that assembles card by card looks like it is still loading. They land
                together, with the rest of the page. */}
            <ProjectCard project={project} index={0} onView={onView} />
          </div>
        ))}
        {/* The second copy is decorative duplication - hidden from screen readers so the same
            projects aren't announced twice. */}
        {sequence.map((project, index) => (
          <div key={`b-${project._id}-${index}`} className="w-[30rem] max-w-[85vw] shrink-0" aria-hidden="true">
            {/* index 0, not the loop index: ProjectCard staggers its mount by index, and a
                strip that assembles card by card looks like it is still loading. They land
                together, with the rest of the page. */}
            <ProjectCard project={project} index={0} onView={onView} />
          </div>
        ))}
      </div>
    </div>
  );
}
