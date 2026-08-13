// Shape and helpers for a project, shared by the form, the card and the detail view. Kept out
// of the component files because a module that exports both components and plain functions
// breaks react-refresh's fast reload.

import { PROJECT_CATEGORIES, PROJECT_STATUSES } from '../config.js';

export const EMPTY_PROJECT_FORM = {
  name: '',
  description: '',
  image: null,
  category_id: '',
  tags: [],
  members: [],
  links: '',
  status: 'active'
};

// Fields the submission form will not send without. Matches the required list in
// backend/lib/projectInput.js, which is what actually enforces it.
export const REQUIRED_TEXT_FIELDS = ['name', 'description', 'category_id', 'links', 'status'];

// Turns a stored project back into what the form edits, for the edit path.
//
// `image` is deliberately null rather than the stored picture: the board's JSON carries no image
// bytes at all (they are served separately - see projectImageUrl), so there is nothing to put
// here. An edit therefore starts with no new image, and PUT /api/projects/:id keeps the stored
// one when the payload omits it. Picking a file replaces it; leaving it alone keeps it.
export function projectToForm(project) {
  if (!project) return EMPTY_PROJECT_FORM;
  return {
    name: project.name ?? '',
    description: project.description ?? '',
    image: null,
    category_id: project.category_id ?? '',
    // Copied, not referenced: the chip pickers replace these arrays as they go, and a cancelled
    // edit must not have mutated the project still sitting on the board behind the dialog.
    tags: Array.isArray(project.tags) ? [...project.tags] : [],
    members: Array.isArray(project.members) ? [...project.members] : [],
    links: project.links ?? '',
    status: project.status ?? 'active'
  };
}

// Projects predating the category picker are stored as 'other', so this falls back rather than
// rendering "undefined" on a card.
export function getCategoryLabel(categoryId) {
  return PROJECT_CATEGORIES.find((category) => category.value === categoryId)?.singular ?? 'Other Project';
}

export function getStatusLabel(status) {
  return PROJECT_STATUSES.find((option) => option.value === status)?.label ?? 'Ongoing';
}

// Where a card's <img> points. The board's JSON omits the image bytes, so this is the only way
// to get them - see api/projects/index.js for why they aren't inlined.
export function projectImageUrl(project) {
  return `/api/projects/${project._id}/image`;
}
