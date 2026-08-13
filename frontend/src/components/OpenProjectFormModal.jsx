import { useEffect, useState } from 'react';
import ModalShell from './ui/ModalShell.jsx';
import Button from './ui/Button.jsx';
import Field from './ui/Field.jsx';
import { PROJECT_CATEGORIES, TIME_COMMITMENTS } from '../config.js';
import { EMPTY_OPEN_PROJECT_FORM, REQUIRED_OPEN_FIELDS, openProjectToForm } from '../lib/openProjectFields.js';

// The post-a-listing form, used for both creating and editing. One component so the two paths
// can't drift apart - the field list here is the one backend/lib/openProjectInput.js validates.

export default function OpenProjectFormModal({
  open,
  mode = 'create',
  project = null,
  isSubmitting = false,
  onSubmit,
  onClose
}) {
  const [formData, setFormData] = useState(EMPTY_OPEN_PROJECT_FORM);
  const [fieldErrors, setFieldErrors] = useState({});

  // Reload whenever it opens, so editing a second listing doesn't inherit the first one's
  // values and a cancelled edit doesn't leave changes behind.
  useEffect(() => {
    if (!open) return;
    setFormData(mode === 'edit' ? openProjectToForm(project) : EMPTY_OPEN_PROJECT_FORM);
    setFieldErrors({});
  }, [open, mode, project]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the user starts fixing it.
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const nextErrors = {};
    for (const name of REQUIRED_OPEN_FIELDS) {
      if (!formData[name]?.trim()) {
        nextErrors[name] = 'This field is required.';
      }
    }
    // Optional, but if it's filled in it has to be a real URL - the server rejects anything
    // else, and catching it here saves an hourly submission slot.
    if (formData.repoUrl.trim() && !/^https?:\/\/.+/i.test(formData.repoUrl.trim())) {
      nextErrors.repoUrl = 'Enter a full URL starting with http:// or https://, or leave it blank.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    onSubmit(formData);
  };

  const isEdit = mode === 'edit';

  return (
    <ModalShell
      open={open}
      onDismiss={onClose}
      panelClassName="max-w-2xl border border-usb-border overflow-hidden flex flex-col max-h-[85vh]"
    >
      <div className="p-4 sm:p-6 border-b border-usb-rule flex justify-between items-center shrink-0">
        <h2 className="font-heading font-bold text-2xl text-usb-charcoal">
          {isEdit ? 'Edit Listing' : 'Post a Project'}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-usb-muted hover:text-usb-charcoal transition-colors cursor-pointer text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          <Field
            id="open-title"
            name="title"
            label="Project Title"
            value={formData.title}
            onChange={handleInputChange}
            error={fieldErrors.title}
            placeholder="e.g. Boiler Course Planner"
            maxLength={200}
          />

          <Field
            as="textarea"
            id="open-description"
            name="description"
            label="What are you building?"
            rows="4"
            controlClassName="resize-none"
            value={formData.description}
            onChange={handleInputChange}
            error={fieldErrors.description}
            placeholder="Explain the project, what stage it's at, and what you're trying to build..."
            maxLength={5000}
          />

          <Field
            as="select"
            id="open-category"
            name="category_id"
            label="Project Type"
            value={formData.category_id}
            onChange={handleInputChange}
            error={fieldErrors.category_id}
          >
            <option value="" disabled>Select a type...</option>
            {PROJECT_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>{category.singular}</option>
            ))}
          </Field>

          <Field
            as="textarea"
            id="open-requirements"
            name="requirements"
            label="Requirements"
            hint="(optional — skills, classes, anything expected)"
            rows="2"
            controlClassName="resize-none"
            value={formData.requirements}
            onChange={handleInputChange}
            error={fieldErrors.requirements}
            placeholder="e.g. Comfortable with Python. CS 180 is plenty — happy to teach the rest."
            maxLength={5000}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-usb-zebra border border-usb-rule p-4 rounded-lg">
            <Field
              id="open-tech-stack"
              name="techStack"
              label="Tech Stack"
              hint="(comma separated)"
              value={formData.techStack}
              onChange={handleInputChange}
              error={fieldErrors.techStack}
              placeholder="e.g. React, Node.js"
            />
            <Field
              id="open-roles"
              name="rolesNeeded"
              label="Roles Needed"
              value={formData.rolesNeeded}
              onChange={handleInputChange}
              error={fieldErrors.rolesNeeded}
              placeholder="e.g. 1 frontend dev, 1 designer"
              maxLength={500}
            />
            <Field
              as="select"
              id="open-time"
              name="timeCommitment"
              label="Time Commitment"
              value={formData.timeCommitment}
              onChange={handleInputChange}
              error={fieldErrors.timeCommitment}
            >
              <option value="" disabled>Select hours...</option>
              {TIME_COMMITMENTS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Field>
            <Field
              id="open-team-size"
              name="teamSize"
              label="Current Team Size"
              value={formData.teamSize}
              onChange={handleInputChange}
              error={fieldErrors.teamSize}
              placeholder="e.g. Just me, or 3 people"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="open-deadline"
              name="deadline"
              type="date"
              label="Accepting Applications Until"
              value={formData.deadline}
              onChange={handleInputChange}
              error={fieldErrors.deadline}
            />
            <Field
              id="open-manager"
              name="manager"
              label="Project Lead"
              value={formData.manager}
              onChange={handleInputChange}
              error={fieldErrors.manager}
              placeholder="Pete Purdue"
              maxLength={200}
            />
          </div>

          <Field
            id="open-contact-email"
            name="contactEmail"
            type="email"
            label="Contact Email"
            hint="(shown publicly — this is where applications are sent)"
            value={formData.contactEmail}
            onChange={handleInputChange}
            error={fieldErrors.contactEmail}
            placeholder="pete@purdue.edu"
            maxLength={200}
          />

          <Field
            id="open-repo"
            name="repoUrl"
            type="url"
            label="Project Link"
            hint="(optional — repo, doc or mockup, if there is one yet)"
            value={formData.repoUrl}
            onChange={handleInputChange}
            error={fieldErrors.repoUrl}
            placeholder="https://github.com/you/your-project"
            maxLength={500}
          />
        </div>

        <div className="p-4 sm:p-6 pt-3 sm:pt-4 flex justify-end gap-3 border-t border-usb-rule shrink-0 bg-white">
          <Button type="button" variant="neutral" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting
              ? (isEdit ? 'Saving...' : 'Posting...')
              : (isEdit ? 'Save Changes' : 'Post Listing')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
