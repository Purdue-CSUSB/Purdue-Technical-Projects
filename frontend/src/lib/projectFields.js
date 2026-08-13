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
