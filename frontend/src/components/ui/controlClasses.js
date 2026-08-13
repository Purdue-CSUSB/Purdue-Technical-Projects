// Shared by input, textarea and select so the three never drift apart. Lives in its own module
// rather than beside <Field> because a file that exports both components and plain functions
// breaks react-refresh's fast reload.
export default function controlClasses(hasError) {
    return `w-full rounded-md border px-3 py-2 font-body text-base bg-white text-usb-charcoal placeholder:text-usb-muted outline-none transition-colors duration-200 ${
        hasError
            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
            : 'border-usb-border focus:border-usb-gold focus:ring-2 focus:ring-usb-gold/40'
    }`
}
