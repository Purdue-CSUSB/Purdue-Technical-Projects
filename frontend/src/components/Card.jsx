import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import UnderlineSwipe from './ui/UnderlineSwipe.jsx';

// A club or a competition, from the JSON files in public/. Both have exactly the same shape -
// name, description, image, link - so they share one card, as they did before.
//
// Still a full-width row rather than a grid tile: these descriptions run to a paragraph or two
// and there are only a handful of each, so a wide row reads better than a clamped card. The
// project board is the opposite case and is laid out accordingly.

// Logos are the point of the tile here, so it is padded and contained rather than cropped.
function ItemImage({ item }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <div className="shrink-0 mx-auto sm:mx-0 w-40 h-40 rounded-xl bg-usb-zebra border border-usb-rule p-3 flex items-center justify-center">
      <img
        src={`${import.meta.env.BASE_URL}${item.image}`}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className="max-w-full max-h-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function ItemCard({ item, index = 0 }) {
  return (
    // `group` so the title's underline reacts to hovering anywhere on the card, the way the
    // main site's cards behave.
    <Card index={index} className="group">
      <div className="flex flex-col sm:flex-row gap-6">
        <ItemImage item={item} />

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-heading font-bold text-2xl text-usb-charcoal mb-3">
            <span className="relative">
              {item.name}
              <UnderlineSwipe color="charcoal" />
            </span>
          </h3>

          {/* whitespace-pre-line: a few of these descriptions carry deliberate line breaks in
              the JSON, which the old card collapsed into one wall of text. */}
          <p className="font-body text-usb-charcoal leading-relaxed whitespace-pre-line mb-6 flex-1">
            {item.description}
          </p>

          <div className="flex sm:justify-end">
            <Button href={item.links} target="_blank" rel="noopener noreferrer" size="sm" fullWidth className="sm:w-auto">
              Visit Website
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
