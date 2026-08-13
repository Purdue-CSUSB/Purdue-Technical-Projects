import { AlertCircle } from 'lucide-react'
import controlClasses from './controlClasses.js'

// Form controls in the main site's idiom: a semibold Raleway label over a lightly-rounded input
// with a grey hairline border. The one thing added here is the error treatment, since the
// submission form does its own validation and needs somewhere to put the message.

// Kept as a standalone export because the submission form renders it under fields that build
// their own markup (the tag and member pickers, the image drop zone), not only under <Field>.
export function FieldError({ message }) {
    if (!message) return null
    return (
        <p className="flex items-center gap-1 mt-1 font-body text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {message}
        </p>
    )
}

export function Label({ htmlFor, children, required = false, className = '' }) {
    return (
        <label
            htmlFor={htmlFor}
            className={`block font-body font-semibold text-sm text-usb-charcoal mb-1 ${className}`}
        >
            {children}
            {required && <span className="text-red-600"> *</span>}
        </label>
    )
}

export default function Field({
    id,
    label,
    error,
    required = false,
    as = 'input',
    hint,
    className = '',
    controlClassName = '',
    children,
    ...rest
}) {
    const Control = as
    return (
        <div className={className}>
            {label && (
                <Label htmlFor={id} required={required}>
                    {label}
                    {hint && <span className="font-normal text-usb-muted"> {hint}</span>}
                </Label>
            )}
            <Control
                id={id}
                aria-invalid={error ? true : undefined}
                className={`${controlClasses(Boolean(error))} ${controlClassName}`}
                {...rest}
            >
                {children}
            </Control>
            <FieldError message={error} />
        </div>
    )
}
