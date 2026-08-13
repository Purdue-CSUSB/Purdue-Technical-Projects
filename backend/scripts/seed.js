// Fills the database with believable development data: `npm run seed`
//
// Refuses to run against a database that already has content unless you pass --force, which
// wipes the three collections first. That guard exists because the connection string in .env is
// the same shape as the production one - a seed script that silently overwrote whatever it found
// would be one typo away from deleting the real board.
//
// Accounts are inserted already verified, with a real bcrypt hash. That is deliberate: signup
// normally emails a 6-digit code, so seeded users would otherwise be unusable on a machine with
// no SMTP configured, and the whole point of seeding is to get a working login without one.
import bcrypt from 'bcryptjs';
import { deflateSync } from 'node:zlib';
import { getDb, getMongoClient, OPEN_PROJECTS_COLLECTION, PROJECTS_COLLECTION } from '../lib/db.js';
import { USERS_COLLECTION } from '../lib/auth.js';

const force = process.argv.includes('--force');

// Every seeded account shares this password. Fine for development, and it is printed at the end
// so there is no guessing; nothing here is ever meant to reach a real deployment.
const PASSWORD = 'BoilerUp2026!';

// --- images -----------------------------------------------------------------------------------
// A minimal PNG encoder, so seeded projects have real image bytes rather than a placeholder that
// the image endpoint would reject. Hand-rolled because the frontend does its own encoding in the
// browser and the backend has no image library - adding one just to seed would be a poor trade.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A solid-colour PNG with a contrasting band, so seeded cards are visually distinguishable. */
function makePng(width, height, [r, g, b]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const band = y > height * 0.62 && y < height * 0.78;
      raw[o++] = band ? 255 : r;
      raw[o++] = band ? 202 : g;
      raw[o++] = band ? 68 : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const image = (rgb) => ({ data: makePng(320, 200, rgb), contentType: 'image/png' });

// --- data --------------------------------------------------------------------------------------
const USERS = [
  { username: 'Pete Purdue', email: 'pete@purdue.edu', isAdmin: false },
  { username: 'Ada Boiler', email: 'ada@purdue.edu', isAdmin: false },
  { username: 'USB Admin', email: 'admin@purdue.edu', isAdmin: true }
];

// [ownerEmail, project]
const SHOWCASE = [
  ['pete@purdue.edu', {
    name: 'Boiler Course Planner',
    description: 'A React and Node app that maps out a CS degree from the course catalog and checks prerequisites against your transcript. Handles the full four-year plan, warns about scheduling conflicts, and exports to a calendar.',
    category_id: 'class-project', status: 'completed',
    tags: ['React', 'Node.js', 'MongoDB', 'Tailwind'],
    members: ['Pete Purdue', 'Ada Boiler'],
    links: 'https://github.com/example/boiler-course-planner',
    image: image([31, 41, 71])
  }],
  ['pete@purdue.edu', {
    name: 'Dorm Laundry Tracker',
    description: 'Sensors on the machines in Cary Quad plus a small Flask site showing which washers and dryers are free right now. Went from a weekend hack to something a few hundred people check every week.',
    category_id: 'personal-project', status: 'active',
    tags: ['Python', 'Flask', 'Raspberry Pi'],
    members: ['Pete Purdue'],
    links: 'https://github.com/example/laundry-tracker',
    image: image([54, 66, 46])
  }],
  ['ada@purdue.edu', {
    name: 'Study Group Finder',
    description: 'Built at BoilerMake in 36 hours. Students post the class they are studying for and get matched into a group chat with others in the same section.',
    category_id: 'hackathon', status: 'completed',
    tags: ['React', 'Firebase', 'Tailwind'],
    members: ['Ada Boiler', 'Sam Student'],
    links: 'https://github.com/example/study-group-finder',
    image: image([72, 38, 38])
  }],
  ['ada@purdue.edu', {
    name: 'Pixel Dungeon Clone',
    description: 'A 2D roguelike made in Unity over winter break, with procedurally generated floors, a light inventory system, and permadeath.',
    category_id: 'personal-project', status: 'active',
    tags: ['Unity', 'C#'],
    members: ['Ada Boiler'],
    links: 'https://github.com/example/pixel-dungeon',
    image: image([40, 40, 40])
  }],
  ['admin@purdue.edu', {
    name: 'Autonomous Line Follower',
    description: 'An Arduino robot built for ECE 264 that follows a taped line and corrects course with a PID loop. Placed second in the end-of-semester run-off.',
    category_id: 'class-project', status: 'completed',
    tags: ['Arduino', 'C++', 'PID'],
    members: ['USB Admin'],
    links: 'https://github.com/example/line-follower',
    image: image([26, 58, 62])
  }],
  // Six rather than five so the board fills two complete rows of three on a desktop grid -
  // a trailing row with a single card in it tells you nothing about how the layout reads.
  ['pete@purdue.edu', {
    name: 'Lecture Notes Search',
    description: 'Full-text search across every PDF and slide deck from a semester of CS courses, with the embeddings built locally so nothing leaves your machine. Started as a way to find one diagram before an exam and turned into the tool half my study group uses.',
    category_id: 'personal-project', status: 'active',
    tags: ['Python', 'FAISS', 'Streamlit', 'PyMuPDF'],
    members: ['Pete Purdue', 'Sam Student'],
    links: 'https://github.com/example/lecture-search',
    image: image([63, 42, 74])
  }]
];

const OPEN = [
  ['pete@purdue.edu', {
    title: 'Campus Accessibility Map',
    description: 'Building a map of step-free routes, working lifts and accessible entrances across campus. The data collection is mostly done; the app itself barely exists yet.',
    category_id: 'personal-project',
    techStack: ['React', 'Mapbox', 'Node.js'],
    rolesNeeded: '1 frontend dev, 1 person for data entry',
    requirements: 'Comfortable with JavaScript. Happy to teach the mapping side.',
    timeCommitment: '5-10 hrs/wk', teamSize: 'Just me',
    deadline: '2026-11-30', manager: 'Pete Purdue', contactEmail: 'pete@purdue.edu',
    repoUrl: 'https://github.com/example/access-map'
  }],
  ['ada@purdue.edu', {
    title: 'ML Model for Bus Arrival Times',
    description: 'Predicting campus bus arrivals from historical GPS traces. Have the data pipeline working, need help with the modelling and a simple frontend to show predictions.',
    category_id: 'personal-project',
    techStack: ['Python', 'PyTorch', 'FastAPI'],
    rolesNeeded: '2 people interested in ML',
    requirements: 'Some exposure to Python. CS 373 helps but is not required.',
    timeCommitment: '10-15 hrs/wk', teamSize: '2 people',
    deadline: '2026-12-15', manager: 'Ada Boiler', contactEmail: 'ada@purdue.edu',
    repoUrl: ''
  }],
  ['ada@purdue.edu', {
    title: 'Hackathon Team for Catapult',
    description: 'Putting together a team for Catapult in the spring. No fixed idea yet - want to settle on something in the first hour and build it properly.',
    category_id: 'hackathon',
    techStack: ['React', 'Node.js', 'Figma'],
    rolesNeeded: '2 more, ideally one designer',
    requirements: '',
    timeCommitment: 'Flexible', teamSize: '2 people',
    deadline: '2026-09-01', manager: 'Ada Boiler', contactEmail: 'ada@purdue.edu',
    repoUrl: ''
  }]
];

async function main() {
  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);
  const projects = db.collection(PROJECTS_COLLECTION);
  const openProjects = db.collection(OPEN_PROJECTS_COLLECTION);

  const existing = await users.countDocuments() + await projects.countDocuments() + await openProjects.countDocuments();
  if (existing > 0 && !force) {
    console.error(`The database already holds ${existing} document(s) across users/projects/open_projects.`);
    console.error('Re-run with --force to wipe those three collections and reseed:\n');
    console.error('  npm run seed -- --force\n');
    process.exit(1);
  }

  if (existing > 0) {
    console.log(`--force: clearing ${existing} existing document(s)...`);
    await Promise.all([users.deleteMany({}), projects.deleteMany({}), openProjects.deleteMany({})]);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  const userDocs = USERS.map((u) => ({
    ...u,
    passwordHash,
    // Pre-verified: signup would normally email a code, and there is no SMTP here.
    emailVerified: true,
    createdAt: now
  }));
  await users.insertMany(userDocs);
  const idFor = Object.fromEntries(userDocs.map((u) => [u.email, u._id]));
  console.log(`users          ${userDocs.length}`);

  // Spread created_at so the newest-first sort has something to actually order.
  await projects.insertMany(SHOWCASE.map(([email, p], i) => ({
    ...p,
    userId: idFor[email],
    email,
    featured: true, // what moderation sets on approval; the board filters on it
    created_at: new Date(now.getTime() - i * 86400000),
    updated_at: new Date(now.getTime() - i * 86400000)
  })));
  console.log(`projects       ${SHOWCASE.length}`);

  await openProjects.insertMany(OPEN.map(([email, p], i) => ({
    ...p,
    userId: idFor[email],
    email,
    createdAt: new Date(now.getTime() - i * 86400000)
  })));
  console.log(`open_projects  ${OPEN.length}`);

  console.log('\nSeeded accounts (same password for all):');
  for (const u of USERS) {
    console.log(`  ${u.email.padEnd(20)} ${PASSWORD}${u.isAdmin ? '   [admin]' : ''}`);
  }
}

main()
  .then(async () => {
    await (await getMongoClient()).close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Seed failed:', error.message);
    try { await (await getMongoClient()).close(); } catch { /* teardown already failed */ }
    process.exit(1);
  });
