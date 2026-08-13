import { Check, AlertTriangle } from 'lucide-react';
import ModalShell from './ui/ModalShell.jsx';
import Button from './ui/Button.jsx';

// Replaces the coloured banner the submit form used to append under the button, which a
// visitor who had scrolled up while the moderation call ran would never see. A dialog is
// unmissable, and the outcome of a submission is worth being unmissable.
//
// Pass `result` = { type: 'success' | 'error', title, message } to open it, or null to close.
const ResultModal = ({ result, onClose }) => {
  const isSuccess = result?.type === 'success';

  // Brand tokens only - gold and charcoal - so this reads as part of the site rather than as a
  // generic alert box. The two states stay distinguishable by inverting the tile, which is the
  // same pairing the darkGold buttons use, and the icon carries the meaning.
  const tone = isSuccess
    ? { tile: 'bg-usb-gold text-usb-charcoal', Icon: Check }
    : { tile: 'bg-usb-charcoal text-usb-gold', Icon: AlertTriangle };

  return (
    <ModalShell
      open={Boolean(result)}
      onDismiss={onClose}
      panelClassName="max-w-md border border-usb-border overflow-hidden flex flex-col max-h-[85vh]"
    >
      <div className="p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center ${tone.tile}`}>
            <tone.Icon className="w-5 h-5" />
          </span>
          <h2 className="font-heading font-bold text-xl text-usb-charcoal">{result?.title}</h2>
        </div>
        <p className="font-body text-usb-charcoal leading-relaxed">{result?.message}</p>
      </div>
      <div className="px-6 py-4 border-t border-usb-rule flex justify-end shrink-0">
        <Button size="sm" onClick={onClose} className="min-w-24">
          OK
        </Button>
      </div>
    </ModalShell>
  );
};

export default ResultModal;
