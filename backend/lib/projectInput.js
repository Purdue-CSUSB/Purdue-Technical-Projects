import { readFileSync } from 'node:fs';
import { requireEnv } from './env.js';
import { MAX_MEMBERS, MAX_TAGS, PROJECT_CATEGORIES, PROJECT_STATUSES } from './constants.js';
import { parseProjectImage } from './projectImage.js';
import { moderateWithPrompt } from './moderation.js';

// Validation and moderation for a SHOWCASE project - finished (or ongoing) work somebody is
// posting to show off. The old controller did neither: it read req.body straight into a
// mongoose document, JSON.parse'd the tags and members fields without a try/catch (so a
// malformed value crashed the request into a 500), and trusted whatever came back. Everything a
// submission is allowed to contain is now decided here.
//
// The open board's listings are a different shape entirely and live in
// backend/lib/openProjectInput.js - see the table there for the field-by-field comparison.

// The moderation prompt lives in a markdown file so it can be edited and reviewed without
// touching code. vercel.json's functions.includeFiles keeps it in the bundle.
//
// Read on first use rather than at import, and cached after, so a warm instance pays for it
// once and a route that imports this module for its validation half never touches the disk.
let moderationPrompt = null;
function getModerationPrompt() {
  if (moderationPrompt === null) {
    moderationPrompt = readFileSync(new URL('../prompts/moderation.md', import.meta.url), 'utf8');
  }
  return moderationPrompt;
}

const isStr = (v) => typeof v === 'string';

// Accepts either a real array (what the form sends) or a comma-separated string, so a
// hand-rolled request in either shape works. Blank entries are dropped rather than stored as
// empty chips.
function toList(value) {
  const raw = Array.isArray(value)
    ? value
    : isStr(value) && value.trim() !== ''
      ? value.split(',')
      : [];

  return raw.filter(isStr).map((item) => item.trim()).filter(Boolean);
}

/**
 * Checks and normalises the showcase project fields from a request body.
 * Returns { fields } on success, or { error: { message, stage } } for the caller to return.
 *
 * `imageRequired` is false on the edit path. Re-uploading an unchanged image would mean the
 * browser re-encoding and re-sending a megabyte to change a typo in the title, so an edit that
 * omits `image` leaves the stored one alone. Supplying one still replaces it, and it is
 * validated exactly as it is on create either way.
 */
export function parseProjectInput(body, { imageRequired = true } = {}) {
  const { name, description, category_id, tags, members, links, status, image } = body || {};

  // Required free text, length-capped. Besides blocking junk and oversized documents, the caps
  // bound how much untrusted text can be pasted into the moderation prompt below.
  const required = [['project name', name, 200], ['description', description, 5000]];
  for (const [label, value, cap] of required) {
    if (!isStr(value) || !value.trim() || value.length > cap) {
      return { error: { message: `A valid ${label} is required (max ${cap} characters).`, stage: 'validation' } };
    }
  }

  if (!isStr(category_id) || !PROJECT_CATEGORIES.includes(category_id)) {
    return { error: { message: 'Please choose a project category.', stage: 'validation' } };
  }

  if (!isStr(status) || !PROJECT_STATUSES.includes(status)) {
    return { error: { message: 'Please choose a project status.', stage: 'validation' } };
  }

  const tagList = toList(tags);
  if (tagList.length === 0 || tagList.length > MAX_TAGS) {
    return { error: { message: `Please add between 1 and ${MAX_TAGS} tags.`, stage: 'validation' } };
  }
  if (tagList.some((tag) => tag.length > 40)) {
    return { error: { message: 'Tags must be 40 characters or fewer.', stage: 'validation' } };
  }

  const memberList = toList(members);
  if (memberList.length === 0 || memberList.length > MAX_MEMBERS) {
    return { error: { message: `Please list between 1 and ${MAX_MEMBERS} team members.`, stage: 'validation' } };
  }
  if (memberList.some((member) => member.length > 100)) {
    return { error: { message: 'Member names must be 100 characters or fewer.', stage: 'validation' } };
  }

  // The project link is rendered as the href of the "Visit Project" button on a public page, so
  // the scheme has to be checked and not merely the shape. Left unvalidated - as it was - a
  // submission could store `javascript:...` and have every visitor's browser run it on click.
  if (!isStr(links) || links.length > 500) {
    return { error: { message: 'A valid project link is required.', stage: 'validation' } };
  }
  let projectLink;
  try {
    projectLink = new URL(links.trim());
  } catch {
    return { error: { message: 'A valid project link is required.', stage: 'validation' } };
  }
  if (projectLink.protocol !== 'http:' && projectLink.protocol !== 'https:') {
    return { error: { message: 'The project link must start with http:// or https://.', stage: 'validation' } };
  }

  const fields = {
    name: name.trim(),
    description: description.trim(),
    category_id,
    status,
    tags: tagList,
    members: memberList,
    links: projectLink.toString()
  };

  // An edit that leaves the image alone sends nothing for it, and `image` is simply absent from
  // the returned fields - so the caller's $set never mentions it and the stored bytes survive.
  const imageOmitted = image === undefined || image === null || image === '';
  if (imageOmitted && !imageRequired) {
    return { fields };
  }

  const parsedImage = parseProjectImage(image);
  if (parsedImage.error) {
    return { error: parsedImage.error };
  }

  return { fields: { ...fields, image: parsedImage.image } };
}

/**
 * Asks the model whether this submission is an acceptable showcase project.
 * Returns { approved: true } or { error: { message, stage } }.
 *
 * Both halves of a posting are reviewed, because both get published and either can sink it: an
 * honest write-up can carry an image nobody should see, and a clean image can be attached to
 * spam. One vision-capable model judges them together in a single call, so the picture is read
 * alongside the text that explains it - which is what keeps a blurry breadboard shot from being
 * rejected as unidentifiable.
 */
export async function moderateProject(fields) {
  return moderateWithPrompt({
    system: getModerationPrompt(),
    submission: [
      `Name: ${fields.name}`,
      `Description: ${fields.description}`,
      `Category: ${fields.category_id}`,
      `Tags: ${fields.tags.join(', ')}`,
      `Team members: ${fields.members.join(', ')}`
    ].join('\n'),
    // Absent only on an edit that kept the stored image - which was reviewed when it was first
    // posted, so there is nothing new to look at and the prompt judges the text alone.
    image: fields.image,
    model: requireEnv('GROQ_MODEL'),
    // One verdict covers both halves, so the message cannot name the guilty one - but it can at
    // least point at everything that was actually looked at.
    rejectionMessage: fields.image
      ? 'That submission was rejected by our moderation filter. Please check both the project details and the image you attached.'
      : 'That submission was rejected by our moderation filter. Please check the project details.'
  });
}
