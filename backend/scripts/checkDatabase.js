// Diagnoses MONGODB_URI: `npm run check-db`
//
// Atlas answers almost every misconfiguration with the same opaque "bad auth : authentication
// failed", which is equally consistent with a typo, an unencoded character, a user that doesn't
// exist, and the placeholder from the Connect dialog never having been replaced. This tells the
// difference. It never prints the password - only its length and whether it contains characters
// that must be percent-encoded.
import { MongoClient } from 'mongodb';
import { requireEnv } from '../lib/env.js';

// Parsed by hand rather than with `new URL()`, because the whole point is to report on strings
// that a strict parser would simply reject.
const URI_SHAPE = /^(mongodb(?:\+srv)?):\/\/(?:([^:@/]*)(?::([^@]*))?@)?([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/;

// Characters that carry meaning inside a connection string. An unencoded one truncates the
// password (or the URI), which surfaces as "bad auth" rather than as a parse error.
const MUST_ENCODE = [...':/?#[]@'];

const uri = requireEnv('MONGODB_URI').trim();
const dbName = requireEnv('MONGODB_DB');

const parsed = URI_SHAPE.exec(uri);
if (!parsed) {
  console.error('MONGODB_URI is not a recognisable MongoDB connection string.');
  process.exit(1);
}
const [, scheme, user, pass, host, pathDb, query] = parsed;

console.log('=== connection string ===');
console.log(`  scheme      : ${scheme}`);
console.log(`  username    : ${user ? JSON.stringify(decodeURIComponent(user)) : '(none)'}`);
console.log(`  password    : ${pass === undefined ? '(none)' : `${pass.length} chars (hidden)`}`);
console.log(`  host        : ${host}`);
console.log(`  path db     : ${pathDb ? JSON.stringify(pathDb) : '(none - correct, MONGODB_DB is separate)'}`);
console.log(`  query       : ${query || '(none)'}`);
console.log(`  MONGODB_DB  : ${JSON.stringify(dbName)}`);

console.log('\n=== checks ===');
const problems = [];

if (!user) problems.push('No username in the URI.');
if (user?.startsWith('<') || user?.endsWith('>')) problems.push('Username is still a <placeholder>.');
if (host.includes('<')) problems.push('Host is still a <placeholder>.');

if (pass === undefined) {
  problems.push('No password in the URI.');
} else {
  if (pass.startsWith('<') || pass.endsWith('>')) {
    problems.push(
      'Password is still the <placeholder> Atlas gives you. Replace it (angle brackets included)\n' +
      '     with the real one: Atlas -> Database Access -> Edit -> Autogenerate Secure Password.'
    );
  }
  const unencoded = MUST_ENCODE.filter((c) => pass.includes(c));
  if (unencoded.length) {
    problems.push(
      `Password contains ${unencoded.map((c) => `"${c}"`).join(', ')}, which must be percent-encoded\n` +
      '     (: %3A   / %2F   ? %3F   # %23   [ %5B   ] %5D   @ %40   % %25).'
    );
  }
}

if (problems.length === 0) console.log('  Nothing obviously wrong with the string.');
else problems.forEach((p) => console.log(`  !! ${p}`));

console.log('\n=== live connection ===');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();
  console.log(`  Connected. Database "${dbName}" has ${collections.length} collection(s):`);
  for (const collection of collections) {
    const count = await db.collection(collection.name).estimatedDocumentCount();
    console.log(`    - ${collection.name} (${count} docs)`);
  }
  if (collections.length === 0) {
    console.log('    (empty - expected on a new database; it fills in on the first write)');
  }
  await client.close();
  process.exit(0);
} catch (error) {
  console.log(`  FAILED: ${error.message}\n`);

  if (/bad auth|authentication failed/i.test(error.message)) {
    console.log('  Atlas is rejecting the username/password pair. Either the password is wrong or');
    console.log('  unencoded (see above), or that user does not exist on THIS cluster.');
  } else if (/ENOTFOUND|querySrv/i.test(error.message)) {
    console.log('  The cluster hostname did not resolve - check the host portion of the URI.');
  } else if (/IP|whitelist|not allowed/i.test(error.message)) {
    console.log('  This IP is not on the Atlas access list. Add 0.0.0.0/0 under Network Access,');
    console.log('  which is what a serverless deployment needs anyway - its IPs are not fixed.');
  } else if (/timed out|ETIMEDOUT/i.test(error.message)) {
    console.log('  Timed out. Usually the Network Access list, or a paused free cluster:');
    console.log('  Atlas pauses one after 30 idle days and only a human can resume it.');
  }

  await client.close().catch(() => {});
  process.exit(1);
}
