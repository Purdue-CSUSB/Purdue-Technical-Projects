import { AlertTriangle } from 'lucide-react';
import ModalShell from './ui/ModalShell.jsx';
import Button from './ui/Button.jsx';

// Site-styled replacement for the browser's native confirm(). Shares its layout with
// ResultModal: icon tile beside the title, body, ruled footer.
const ConfirmModal = ({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) => {
  return (
    <ModalShell
      open={open}
      onDismiss={onCancel}
      panelClassName="max-w-md border border-usb-border overflow-hidden flex flex-col max-h-[85vh]"
    >
      <div className="p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 shrink-0 rounded-lg bg-usb-charcoal text-usb-gold flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <h2 className="font-heading font-bold text-xl text-usb-charcoal">{title}</h2>
        </div>
        <p className="font-body text-usb-charcoal leading-relaxed">{message}</p>
      </div>
      <div className="px-6 py-4 border-t border-usb-rule flex justify-end gap-3 shrink-0">
        <Button variant="neutral" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {/* Charcoal rather than red: red isn't part of the site's palette, and the icon, the
            title and the message already make the consequence clear. The light-grey Cancel
            beside it keeps the two visually distinct. */}
        <Button variant="dark" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
};

export default ConfirmModal;
