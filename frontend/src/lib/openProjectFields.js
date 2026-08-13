// Shape and helpers for an OPEN project - one still being built that is looking for teammates.
// Deliberately a different set of fields from a showcase project (see lib/projectFields.js and
// the table in backend/lib/openProjectInput.js): this board answers "what are you building and
// who do you still need", not "what did you finish".
//
// Kept out of the component files because a module that exports both components and plain
// functions breaks react-refresh's fast reload.

export const EMPTY_OPEN_PROJECT_FORM = {
  title: '',
  description: '',
  category_id: '',
  techStack: '',
  rolesNeeded: '',
  requirements: '',
  timeCommitment: '',
  teamSize: '',
  deadline: '',
  manager: '',
  contactEmail: '',
  repoUrl: ''
};

// Drives the themed inline validation instead of the browser's native "fill out this field"
// bubble. Matches the required list in backend/lib/openProjectInput.js, which is what actually
// enforces it. `repoUrl` and `requirements` are deliberately absent - a project that hasn't
// started often has no repo yet, and not every listing has hard prerequisites.
export const REQUIRED_OPEN_FIELDS = [
  'title', 'description', 'category_id', 'techStack', 'rolesNeeded',
  'timeCommitment', 'teamSize', 'deadline', 'manager', 'contactEmail'
];

// A saved listing stores techStack as an array; the form edits it as a comma-separated string.
export function openProjectToForm(project) {
  if (!project) return EMPTY_OPEN_PROJECT_FORM;
  return {
    title: project.title ?? '',
    description: project.description ?? '',
    category_id: project.category_id ?? '',
    techStack: Array.isArray(project.techStack) ? project.techStack.join(', ') : (project.techStack ?? ''),
    rolesNeeded: project.rolesNeeded ?? '',
    requirements: project.requirements ?? '',
    timeCommitment: project.timeCommitment ?? '',
    teamSize: project.teamSize ?? '',
    deadline: project.deadline ?? '',
    manager: project.manager ?? '',
    contactEmail: project.contactEmail ?? '',
    repoUrl: project.repoUrl ?? ''
  };
}

// Only produced when the listing carries a public contact address, so a listing without one
// gets no button rather than a mailto: reading "undefined".
export function buildMailto(project) {
  if (!project?.contactEmail) return null;
  const body = [
    `Hi ${project.manager},`,
    '',
    `I saw your ${project.title} listing on the Purdue Technical Projects board and I'd like to help out.`,
    '',
    '--- About me ---',
    'Name: ',
    'Major & year: ',
    'Relevant experience: ',
    '',
    "Why I'm interested: ",
    ''
  ].join('\r\n');

  return `mailto:${project.contactEmail}?subject=${encodeURIComponent(`Joining: ${project.title}`)}&body=${encodeURIComponent(body)}`;
}

// A listing whose deadline has passed is still shown, but marked - taking it down is the
// poster's call, and a stale date is more useful than a card that silently vanishes.
export function isExpired(project) {
  if (!project?.deadline) return false;
  const deadline = new Date(project.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  // Compare against the start of today so a listing open "until the 5th" is still open all day
  // on the 5th rather than expiring at midnight.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline < today;
}
