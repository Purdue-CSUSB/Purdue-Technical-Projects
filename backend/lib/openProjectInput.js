import { readFileSync } from 'node:fs';
import { requireEnv } from './env.js';
import { MAX_TECH_STACK, PROJECT_CATEGORIES } from './constants.js';
import { moderateWithPrompt } from './moderation.js';

// Validation and moderation for an OPEN project - one that is still being built and is looking
// for people to join it. Shared by POST /api/open-projects (create) and PUT
// /api/open-projects/[id] (edit): both accept the same form, so both have to enforce the same
// rules, or a clean listing could be edited into anything afterwards.
//
// This is a DIFFERENT SHAPE from a showcase project (backend/lib/projectInput.js), on purpose.
// The two boards answer different questions and so store different things:
//
//   showcase (`projects`)          open (`open_projects`)
//   -------------------------      ----------------------------
//   name                           title
//   description                    description
//   image (required, in Mongo)     - no image: a project that doesn't exist yet has nothing
//                                    to screenshot
//   tags[]                         techStack[]      - what it's built WITH, not what it's about
//   members[] (who built it)       rolesNeeded      - who is still missing
//   links (repo/demo, required)    repoUrl          - optional; often nothing public yet
//   status (active|completed)      - always in progress by definition
//   -                              requirements     - skills/classes expected of a joiner
//   -                              timeCommitment   - hours per week
//   -                              teamSize         - how big the team is now
//   -                              deadline         - when applications close
//   -                              contactEmail     - public, how to apply
//   -                              manager          - who is leading it
//
// The overlap is only category_id, which is shared so both boards speak the same vocabulary.

let moderationPrompt = null;
function getModerationPrompt() {
  if (moderationPrompt === null) {
    moderationPrompt = readFileSync(new URL('../prompts/openProjectModeration.md', import.meta.url), 'utf8');
  }
  return moderationPrompt;
}

const isStr = (v) => typeof v === 'string';

// Accepts either a real array (what the form sends) or a comma-separated string, so a
// hand-rolled request in either shape works. Blank entries are dropped.
function toList(value) {
  const raw = Array.isArray(value)
    ? value
    : isStr(value) && value.trim() !== ''
      ? value.split(',')
      : [];

  return raw.filter(isStr).map((item) => item.trim()).filter(Boolean);
}

/**
 * Checks and normalises an open-project payload.
 * Returns { fields } on success, or { error: { message, stage } } for the caller to return.
 */
export function parseOpenProjectInput(body) {
  const {
    title,
    description,
    category_id,
    techStack,
    rolesNeeded,
    requirements,
    timeCommitment,
    teamSize,
    deadline,
    manager,
    contactEmail,
    repoUrl
  } = body || {};

  // Required free text, length-capped. Besides blocking junk and oversized documents, the caps
  // bound how much untrusted text is pasted into the moderation prompt.
  const required = [
    ['title', title, 200],
    ['description', description, 5000],
    ['roles needed', rolesNeeded, 500],
    ['project lead name', manager, 200]
  ];
  for (const [label, value, cap] of required) {
    if (!isStr(value) || !value.trim() || value.length > cap) {
      return { error: { message: `A valid ${label} is required (max ${cap} characters).`, stage: 'validation' } };
    }
  }

  if (!isStr(category_id) || !PROJECT_CATEGORIES.includes(category_id)) {
    return { error: { message: 'Please choose a project category.', stage: 'validation' } };
  }

  // contactEmail is the one address on a listing that IS meant to be public - it is typed into
  // the form so applicants have somewhere to write, and is deliberately separate from the
  // account's own email, which stays hidden by the projection in api/open-projects/index.js.
  // Shape-checked only: deliverability is the poster's problem, but a value that isn't an
  // address at all would render a broken mailto: on every card.
  if (!isStr(contactEmail) || contactEmail.length > 200) {
    return { error: { message: 'A valid contact email is required.', stage: 'validation' } };
  }
  const publicContactEmail = contactEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicContactEmail)) {
    return { error: { message: 'A valid contact email is required.', stage: 'validation' } };
  }

  const techStackList = toList(techStack);
  if (techStackList.length === 0 || techStackList.length > MAX_TECH_STACK) {
    return { error: { message: `Please list between 1 and ${MAX_TECH_STACK} technologies.`, stage: 'validation' } };
  }
  if (techStackList.some((tech) => tech.length > 40)) {
    return { error: { message: 'Tech stack entries must be 40 characters or fewer.', stage: 'validation' } };
  }

  const optional = [
    ['requirements', requirements, 5000],
    ['time commitment', timeCommitment, 100],
    ['team size', teamSize, 100],
    ['deadline', deadline, 100]
  ];
  for (const [label, value, cap] of optional) {
    if (value !== undefined && value !== null && (!isStr(value) || value.length > cap)) {
      return { error: { message: `Invalid ${label}.`, stage: 'validation' } };
    }
  }

  // Optional here, unlike the showcase's required `links`: a project looking for teammates
  // often has nothing public to show yet. When one IS given it is rendered as an href on a
  // public page, so the scheme is checked exactly as it is on the showcase side.
  let normalizedRepoUrl = '';
  if (isStr(repoUrl) && repoUrl.trim()) {
    if (repoUrl.length > 500) {
      return { error: { message: 'That project link is too long.', stage: 'validation' } };
    }
    let parsed;
    try {
      parsed = new URL(repoUrl.trim());
    } catch {
      return { error: { message: 'The project link must be a full URL, or left blank.', stage: 'validation' } };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: { message: 'The project link must start with http:// or https://.', stage: 'validation' } };
    }
    normalizedRepoUrl = parsed.toString();
  }

  return {
    fields: {
      title: title.trim(),
      description: description.trim(),
      category_id,
      techStack: techStackList,
      rolesNeeded: rolesNeeded.trim(),
      requirements: isStr(requirements) ? requirements.trim() : '',
      timeCommitment: isStr(timeCommitment) ? timeCommitment.trim() : '',
      teamSize: isStr(teamSize) ? teamSize.trim() : '',
      deadline: isStr(deadline) ? deadline.trim() : '',
      manager: manager.trim(),
      contactEmail: publicContactEmail,
      repoUrl: normalizedRepoUrl
    }
  };
}

/**
 * Asks the model whether this is an acceptable listing for the open board.
 * Returns { approved: true } or { error: { message, stage } }.
 */
export async function moderateOpenProject(fields) {
  return moderateWithPrompt({
    system: getModerationPrompt(),
    submission: [
      `Title: ${fields.title}`,
      `Description: ${fields.description}`,
      `Category: ${fields.category_id}`,
      `Tech stack: ${fields.techStack.join(', ')}`,
      `Roles needed: ${fields.rolesNeeded}`,
      `Requirements: ${fields.requirements || 'N/A'}`
    ].join('\n'),
    model: requireEnv('GROQ_MODEL')
  });
}
