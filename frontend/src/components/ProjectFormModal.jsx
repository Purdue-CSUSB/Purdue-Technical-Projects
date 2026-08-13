import { useEffect, useRef, useState } from 'react';
import { Upload, X, Plus, Link as LinkIcon, Loader2 } from 'lucide-react';
import ModalShell from './ui/ModalShell.jsx';
import Button from './ui/Button.jsx';
import Field, { FieldError, Label } from './ui/Field.jsx';
import { MAX_MEMBERS, MAX_TAGS, PROJECT_CATEGORIES, PROJECT_STATUSES } from '../config.js';
import { EMPTY_PROJECT_FORM, projectImageUrl, projectToForm } from '../lib/projectFields.js';
import { ImageUploadError, prepareProjectImage } from '../lib/imageUpload.js';

// Posting a finished project to the showcase, or editing one already on it. A dialog on the
// board rather than a page of its own: the thing being created ends up here, so you never leave
// the context you're adding to - and it matches how the Find a Project board has always worked,
// so the two boards are one interaction rather than two.
//
// One dialog serves both modes, the same way OpenProjectFormModal does. A separate edit dialog
// would be a second copy of every field, every limit and every validation rule to keep in step.

// A removable chip, shared by the tags and members pickers so the two can't drift apart.
function Chip({ label, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 bg-usb-gold/25 border border-usb-gold font-body text-sm rounded-full text-usb-charcoal">
            <span className="max-w-[12rem] truncate" title={label}>{label}</span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
                className="text-usb-muted hover:text-usb-charcoal transition-colors cursor-pointer"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </span>
    );
}

// The tag and member pickers are the same control with different copy and different limits.
function ChipInput({ id, label, hint, values, onAdd, onRemove, placeholder, limit, error }) {
    const [draft, setDraft] = useState('');
    const isFull = values.length >= limit;
    const canAdd = draft.trim() !== '' && !isFull && !values.includes(draft.trim());

    const commit = () => {
        if (!canAdd) return;
        onAdd(draft.trim());
        setDraft('');
    };

    return (
        <div>
            <Label htmlFor={id} required>
                {label}
                {hint && <span className="font-normal text-usb-muted"> {hint}</span>}
            </Label>

            {values.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {values.map((value) => (
                        <Chip key={value} label={value} onRemove={() => onRemove(value)} />
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <input
                    id={id}
                    type="text"
                    value={draft}
                    disabled={isFull}
                    placeholder={isFull ? `Limit of ${limit} reached` : placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                    // Enter adds a chip rather than submitting the form around it. onKeyDown,
                    // not the deprecated onKeyPress - that event never fires at all in some
                    // browsers, which would make Enter silently submit instead.
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        }
                    }}
                    className={`flex-1 min-w-0 rounded-md border px-3 py-2 font-body text-base bg-white text-usb-charcoal placeholder:text-usb-muted outline-none transition-colors duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        error
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-usb-border focus:border-usb-gold focus:ring-2 focus:ring-usb-gold/40'
                    }`}
                />
                <Button type="button" size="sm" lift={false} disabled={!canAdd} onClick={commit} aria-label={`Add ${label.toLowerCase()}`}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>

            <p className="font-body text-xs text-usb-muted mt-1">{values.length} of {limit}</p>
            <FieldError message={error} />
        </div>
    );
}

// Radio group rendered as selectable cards. These are real <input type="radio"> elements styled
// with has-checked, rather than an appearance-none checkbox faked into looking like one.
function ChoiceGroup({ name, label, options, value, onChange, error, columns = 'sm:grid-cols-3' }) {
    return (
        <fieldset>
            <legend className="block font-body font-semibold text-sm text-usb-charcoal mb-1">
                {label}<span className="text-red-600"> *</span>
            </legend>
            <div className={`grid grid-cols-1 ${columns} gap-3`}>
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="relative flex items-center gap-3 p-4 rounded-lg border border-usb-border bg-white cursor-pointer transition-colors duration-200 hover:bg-usb-zebra has-checked:border-usb-gold has-checked:bg-usb-gold/15"
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            className="w-4 h-4 shrink-0 accent-usb-charcoal cursor-pointer"
                        />
                        <span className="font-body text-sm font-semibold text-usb-charcoal">
                            {option.singular ?? option.label}
                        </span>
                    </label>
                ))}
            </div>
            <FieldError message={error} />
        </fieldset>
    );
}

export default function ProjectFormModal({
    open,
    mode = 'create',
    project = null,
    isSubmitting = false,
    onSubmit,
    onClose
}) {
    const isEdit = mode === 'edit';
    const [form, setForm] = useState(EMPTY_PROJECT_FORM);
    const [errors, setErrors] = useState({});
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    // Preview thumbnails are object URLs, which stay allocated until revoked. Held in a ref so
    // replacing an image (or closing the dialog mid-form) can release the previous one.
    const previewUrl = useRef(null);

    const releasePreview = () => {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = null;
    };

    // Reload every time it opens: a cancelled draft must not come back on the next open, and
    // editing a second project must not inherit the first one's values.
    useEffect(() => {
        if (!open) return;
        releasePreview();
        setForm(isEdit ? projectToForm(project) : EMPTY_PROJECT_FORM);
        setErrors({});
        setIsDragging(false);
    }, [open, isEdit, project]);

    // Release the last preview when the dialog leaves the tree entirely.
    useEffect(() => releasePreview, []);

    const setField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        // Clear a field's error as soon as the user starts fixing it.
        setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    };

    const handleFile = async (file) => {
        if (!file) return;
        setIsPreparingImage(true);
        setErrors((prev) => ({ ...prev, image: undefined }));

        try {
            // Downscaling and encoding happen here, in the browser, before anything is sent -
            // see lib/imageUpload.js for why.
            const prepared = await prepareProjectImage(file);
            releasePreview();
            previewUrl.current = prepared.previewUrl;
            setField('image', { ...prepared, fileName: file.name });
        } catch (error) {
            const message = error instanceof ImageUploadError
                ? error.message
                : 'That image could not be processed. Please try another file.';
            if (!(error instanceof ImageUploadError)) console.error('Image processing failed:', error);
            setErrors((prev) => ({ ...prev, image: message }));
        } finally {
            setIsPreparingImage(false);
        }
    };

    const clearImage = () => {
        releasePreview();
        setField('image', null);
    };

    const validate = () => {
        const next = {};
        if (!form.name.trim()) next.name = 'This field is required.';
        if (!form.description.trim()) next.description = 'This field is required.';
        if (!form.category_id) next.category_id = 'Please choose a category.';
        if (!form.status) next.status = 'Please choose a status.';
        if (form.tags.length === 0) next.tags = 'Add at least one tag.';
        if (form.members.length === 0) next.members = 'Add at least one team member.';
        // Only on create. An edit that picks no file keeps the image already stored, which is
        // what PUT /api/projects/:id does with an omitted `image` - re-uploading a megabyte to
        // fix a typo in the title would be absurd.
        if (!isEdit && !form.image) next.image = 'A project image is required.';

        const link = form.links.trim();
        if (!link) {
            next.links = 'This field is required.';
        } else if (!/^https?:\/\/.+/i.test(link)) {
            // The server checks this too. Catching it here saves a round trip and, more to the
            // point, saves burning one of the five hourly submissions on a typo.
            next.links = 'Enter a full URL starting with http:// or https://.';
        }

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSubmitting || isPreparingImage) return;
        if (!validate()) return;

        const payload = {
            name: form.name.trim(),
            description: form.description.trim(),
            category_id: form.category_id,
            status: form.status,
            tags: form.tags,
            members: form.members,
            links: form.links.trim()
        };

        // Sent only when a file was actually picked. On an edit with no new image the key is
        // absent entirely, which is the signal to keep the stored picture - sending null or ''
        // would instead be read as an invalid image and rejected.
        if (form.image) payload.image = form.image.dataUrl;

        onSubmit(payload);
    };

    const dropZoneState = isDragging
        ? 'border-usb-gold bg-usb-gold/15'
        : errors.image
            ? 'border-red-500 bg-white'
            : 'border-usb-border bg-white hover:border-usb-gold';

    return (
        <ModalShell
            open={open}
            onDismiss={onClose}
            panelClassName="max-w-2xl border border-usb-border overflow-hidden flex flex-col max-h-[85vh]"
        >
            <div className="p-4 sm:p-6 border-b border-usb-rule flex justify-between items-center shrink-0">
                <div>
                    <h2 className="font-heading font-bold text-2xl text-usb-charcoal">
                        {isEdit ? 'Edit Project' : 'Post a Project'}
                    </h2>
                    <p className="font-body text-sm text-usb-muted mt-0.5">
                        {isEdit
                            ? 'Edits are reviewed the same way posts are — approved changes go live straight away.'
                            : 'Reviewed automatically — approved posts go live straight away.'}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="shrink-0 text-usb-muted hover:text-usb-charcoal transition-colors cursor-pointer text-lg leading-none"
                >
                    ✕
                </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
                <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
                    <Field
                        id="project-name"
                        label="Project Name"
                        required
                        value={form.name}
                        onChange={(e) => setField('name', e.target.value)}
                        error={errors.name}
                        placeholder="e.g. Boiler Course Planner"
                        maxLength={200}
                    />

                    <Field
                        as="textarea"
                        id="project-description"
                        label="Description"
                        hint="(what it does, how you built it, what makes it interesting)"
                        required
                        rows={5}
                        controlClassName="resize-y"
                        value={form.description}
                        onChange={(e) => setField('description', e.target.value)}
                        error={errors.description}
                        placeholder="Describe your project, the technologies you used, and what you're proud of..."
                        maxLength={5000}
                    />

                    <div>
                        <Label htmlFor="image-upload" required={!isEdit}>
                            Project Image
                            <span className="font-normal text-usb-muted">
                                {isEdit
                                    ? ' (upload a new one only if you want to replace it)'
                                    : ' (a screenshot, logo or photo)'}
                            </span>
                        </Label>

                        {form.image ? (
                            <div className="flex items-center gap-4 p-4 rounded-lg border border-usb-border bg-usb-zebra">
                                <div className="w-20 h-20 shrink-0 rounded-lg bg-white border border-usb-rule overflow-hidden flex items-center justify-center">
                                    <img src={form.image.previewUrl} alt="" className="max-w-full max-h-full object-contain" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-body text-sm font-semibold text-usb-charcoal truncate" title={form.image.fileName}>
                                        {form.image.fileName}
                                    </p>
                                    {/* Worth showing: it is usually a fraction of what was
                                        picked, which explains why the upload is instant. */}
                                    <p className="font-body text-xs text-usb-muted mt-0.5">
                                        Resized for upload · {Math.max(1, Math.round(form.image.bytes / 1024))} KB
                                    </p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" lift={false} onClick={clearImage}>
                                    Replace
                                </Button>
                            </div>
                        ) : isEdit && project ? (
                            /* Editing, with no new file picked. The bytes aren't in the board's
                               JSON, so the stored picture is shown from the image endpoint - the
                               same URL the card renders - rather than left as an empty drop zone
                               that reads as "this project has no image". */
                            <div className="flex items-center gap-4 p-4 rounded-lg border border-usb-border bg-usb-zebra">
                                <div className="w-20 h-20 shrink-0 rounded-lg bg-white border border-usb-rule overflow-hidden flex items-center justify-center">
                                    <img src={projectImageUrl(project)} alt="" className="max-w-full max-h-full object-contain" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-body text-sm font-semibold text-usb-charcoal">Current image</p>
                                    <p className="font-body text-xs text-usb-muted mt-0.5">
                                        Kept as it is unless you choose a new one.
                                    </p>
                                </div>
                                <input
                                    id="image-upload"
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => handleFile(e.target.files?.[0])}
                                />
                                {/* A label rather than a Button: it has to drive the file input,
                                    and a <button> wrapping one can't. Styled to match the ghost
                                    Button beside it in the picked-image state above. */}
                                <label
                                    htmlFor="image-upload"
                                    className="shrink-0 inline-flex items-center justify-center rounded-md px-3 py-1.5 font-body text-sm font-semibold text-usb-charcoal border border-usb-border bg-white hover:bg-usb-zebra transition-colors cursor-pointer"
                                >
                                    {isPreparingImage ? 'Preparing...' : 'Replace'}
                                </label>
                            </div>
                        ) : (
                            <div
                                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-200 ${dropZoneState}`}
                                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragOver={(e) => e.preventDefault()}
                                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    handleFile(e.dataTransfer.files?.[0]);
                                }}
                            >
                                <input
                                    id="image-upload"
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => handleFile(e.target.files?.[0])}
                                />
                                <label htmlFor="image-upload" className="cursor-pointer block">
                                    {isPreparingImage ? (
                                        <Loader2 className="w-8 h-8 mx-auto mb-2 text-usb-muted animate-spin" />
                                    ) : (
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-usb-muted" />
                                    )}
                                    <p className="font-body font-semibold text-usb-charcoal">
                                        {isPreparingImage ? 'Preparing image...' : 'Click to upload, or drag and drop'}
                                    </p>
                                    <p className="font-body text-sm text-usb-muted mt-1">
                                        PNG, JPG, GIF or WebP, up to 10MB
                                    </p>
                                </label>
                            </div>
                        )}
                        <FieldError message={errors.image} />
                    </div>

                    <ChoiceGroup
                        name="category_id"
                        label="Category"
                        options={PROJECT_CATEGORIES}
                        value={form.category_id}
                        onChange={(value) => setField('category_id', value)}
                        error={errors.category_id}
                    />

                    <ChipInput
                        id="project-tags"
                        label="Tags"
                        hint="(languages, frameworks, topics)"
                        values={form.tags}
                        onAdd={(tag) => setField('tags', [...form.tags, tag])}
                        onRemove={(tag) => setField('tags', form.tags.filter((t) => t !== tag))}
                        placeholder="e.g. React"
                        limit={MAX_TAGS}
                        error={errors.tags}
                    />

                    <ChipInput
                        id="project-members"
                        label="Team Members"
                        hint="(everyone who worked on it)"
                        values={form.members}
                        onAdd={(member) => setField('members', [...form.members, member])}
                        onRemove={(member) => setField('members', form.members.filter((m) => m !== member))}
                        placeholder="e.g. Pete Purdue"
                        limit={MAX_MEMBERS}
                        error={errors.members}
                    />

                    <div>
                        <Label htmlFor="project-links" required>
                            Project Link
                            <span className="font-normal text-usb-muted"> (repo, demo or write-up)</span>
                        </Label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-usb-muted pointer-events-none" />
                            <input
                                id="project-links"
                                type="url"
                                value={form.links}
                                onChange={(e) => setField('links', e.target.value)}
                                placeholder="https://github.com/you/your-project"
                                aria-invalid={errors.links ? true : undefined}
                                className={`w-full rounded-md border pl-10 pr-3 py-2 font-body text-base bg-white text-usb-charcoal placeholder:text-usb-muted outline-none transition-colors duration-200 ${
                                    errors.links
                                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                        : 'border-usb-border focus:border-usb-gold focus:ring-2 focus:ring-usb-gold/40'
                                }`}
                            />
                        </div>
                        <FieldError message={errors.links} />
                    </div>

                    <ChoiceGroup
                        name="status"
                        label="Status"
                        options={PROJECT_STATUSES}
                        value={form.status}
                        onChange={(value) => setField('status', value)}
                        error={errors.status}
                        columns="sm:grid-cols-2"
                    />
                </div>

                <div className="p-4 sm:p-6 pt-3 sm:pt-4 flex justify-end gap-3 border-t border-usb-rule shrink-0 bg-white">
                    <Button type="button" variant="neutral" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={isSubmitting || isPreparingImage}>
                        {isSubmitting ? 'Reviewing...' : isEdit ? 'Save Changes' : 'Post Project'}
                    </Button>
                </div>
            </form>
        </ModalShell>
    );
}
