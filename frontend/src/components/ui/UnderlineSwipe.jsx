// The main USB site's signature hover affordance: a rule that wipes in from the left edge of
// the text. It appears on every nav link, footer link, and card title over there, so reusing
// it here is most of what makes the sites read as one family.
//
// Requires `group` on an ancestor and `relative` on the element wrapping the text.
const COLORS = {
    ink: 'bg-usb-ink',
    white: 'bg-white',
    charcoal: 'bg-usb-charcoal',
    gold: 'bg-usb-gold'
}

export default function UnderlineSwipe({ color = 'ink', active = false }) {
    return (
        <span
            aria-hidden="true"
            className={`absolute left-0 -bottom-1 block w-full h-0.5 origin-left transition-transform duration-300 ease-out ${COLORS[color]} ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
        />
    )
}
