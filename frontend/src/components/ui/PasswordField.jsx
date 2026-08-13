import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Label, FieldError } from './Field.jsx'
import controlClasses from './controlClasses.js'

// A password input with a show/hide toggle, so nobody has to guess what they typed behind the
// dots. Kept separate from <Field> because it owns the reveal state and needs the button
// layered inside the control.
//
// `labelRight` is for the login form, which puts a "Forgot password?" link on the label row.
export default function PasswordField({
    id,
    label = 'Password',
    labelRight,
    hint,
    error,
    required = false,
    className = '',
    ...rest
}) {
    const [isVisible, setIsVisible] = useState(false)
    // The toggle sits on top of the input, so the text needs room to not run underneath it.
    // Set inline rather than as a `pr-11` class: controlClasses already sets px-3, and which of
    // two conflicting padding utilities wins comes down to stylesheet order.
    const { style, ...inputProps } = rest

    return (
        <div className={className}>
            {(label || labelRight) && (
                <div className="flex items-center justify-between">
                    {label && (
                        <Label htmlFor={id} required={required}>
                            {label}
                            {hint && <span className="font-normal text-usb-muted"> {hint}</span>}
                        </Label>
                    )}
                    {labelRight}
                </div>
            )}
            <div className="relative">
                <input
                    id={id}
                    type={isVisible ? 'text' : 'password'}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    className={controlClasses(Boolean(error))}
                    style={{ paddingRight: '2.75rem', ...style }}
                    {...inputProps}
                />
                <button
                    type="button"
                    onClick={() => setIsVisible((visible) => !visible)}
                    aria-label={isVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={isVisible}
                    // It stays focusable (tabIndex -1 would hide it from keyboard users), and
                    // type="button" keeps it from submitting the form it sits in.
                    className="absolute inset-y-0 right-0 flex items-center px-3 rounded-md text-usb-muted hover:text-usb-charcoal transition-colors duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-usb-gold"
                >
                    {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>
            <FieldError message={error} />
        </div>
    )
}
