import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Generic mysqldump parser
//
// The original version of this script read the dump line-by-line and only
// looked at lines starting with '(' . That only works for dumps produced
// with --skip-extended-insert. A normal mysqldump bundles many rows into a
// single INSERT statement:
//   INSERT INTO `t` (...) VALUES (row1),(row2),...,(rowN);
// and large tables get split across several such statements. Some field
// values (bios, descriptions) also contain literal newlines, which breaks
// naive line-based reading regardless. This parser scans the raw file text
// directly, tracking quote/escape state, so it doesn't care about line
// breaks or how many rows are bundled per statement.
// ---------------------------------------------------------------------------

type SqlValue = string | null;

const ESCAPE_RE = /\\(.)/g;
function unescapeSqlValue(str: string): string {
  return str.replace(ESCAPE_RE, (_, c: string) => {
    switch (c) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case '0': return '\0';
      case 'Z': return '\x1a';
      default: return c;
    }
  });
}

// Splits one row's inner "(...)" content on top-level commas, respecting
// quotes/escapes, without char-by-char string concatenation (important for
// tables like postmeta that can contain multi-KB/MB serialized blob values).
function splitFields(inner: string): SqlValue[] {
  const fields: string[] = [];
  let i = 0;
  const n = inner.length;
  let fieldStart = 0;

  while (i < n) {
    const c = inner[i];
    if (c === "'") {
      i++;
      while (i < n) {
        if (inner[i] === '\\') { i += 2; continue; }
        if (inner[i] === "'") { i++; break; }
        i++;
      }
      continue;
    } else if (c === ',') {
      fields.push(inner.slice(fieldStart, i).trim());
      i++;
      fieldStart = i;
      continue;
    } else {
      i++;
    }
  }
  fields.push(inner.slice(fieldStart, i).trim());

  return fields.map((f) => {
    if (f === 'NULL') return null;
    if (f.length >= 2 && f[0] === "'" && f[f.length - 1] === "'") {
      return unescapeSqlValue(f.slice(1, -1));
    }
    return f; // raw numeric/other literal, kept as string
  });
}

function parseValuesBlock(text: string, start: number): { rows: SqlValue[][]; endIndex: number } {
  const rows: SqlValue[][] = [];
  let i = start;
  const n = text.length;
  let depth = 0;
  let rowStart = -1;

  while (i < n) {
    const c = text[i];
    if (c === "'") {
      i++;
      while (i < n) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === "'") { i++; break; }
        i++;
      }
      continue;
    } else if (c === '(') {
      if (depth === 0) rowStart = i + 1;
      depth++;
      i++;
      continue;
    } else if (c === ')') {
      depth--;
      if (depth === 0) {
        rows.push(splitFields(text.slice(rowStart, i)));
      }
      i++;
      continue;
    } else if (c === ';' && depth === 0) {
      return { rows, endIndex: i + 1 };
    } else {
      i++;
    }
  }
  return { rows, endIndex: i };
}

// Finds every "INSERT INTO `table` ... VALUES ...;" chunk for a table
// (there may be several, for large tables) and parses all rows from all of them.
function parseTable(fullText: string, tableName: string): SqlValue[][] {
  const marker = 'INSERT INTO `' + tableName + '`';
  let idx = 0;
  const allRows: SqlValue[][] = [];
  while (true) {
    const foundAt = fullText.indexOf(marker, idx);
    if (foundAt === -1) break;
    const valuesIdx = fullText.indexOf('VALUES', foundAt);
    const { rows, endIndex } = parseValuesBlock(fullText, valuesIdx + 'VALUES'.length + 1);
    allRows.push(...rows);
    idx = endIndex;
  }
  return allRows;
}

// ---------------------------------------------------------------------------
// Migration-specific logic (same shape/behavior as the original script)
// ---------------------------------------------------------------------------

async function exportUsers() {
  const sqlDumpPath = process.argv[2] || 'beleqend_jobs.sql';
  const outputPath = process.argv[3] || 'users-migration.json';

  if (!fs.existsSync(sqlDumpPath)) {
    console.error(`Error: SQL dump not found at ${sqlDumpPath}`);
    console.log(`Usage: npx ts-node scripts/export-wp-users.ts [path/to/database.sql] [path/to/output.json]`);
    return;
  }

  console.log('Reading dump into memory...');
  const fullText = fs.readFileSync(sqlDumpPath, 'utf8');
  console.log(`Read ${fullText.length.toLocaleString()} characters.`);

  console.log('Parsing jobs_users...');
  const userRows = parseTable(fullText, 'jobs_users');
  console.log(`  -> ${userRows.length.toLocaleString()} rows`);

  console.log('Parsing jobs_usermeta...');
  const userMetaRows = parseTable(fullText, 'jobs_usermeta');
  console.log(`  -> ${userMetaRows.length.toLocaleString()} rows`);

  console.log('Parsing jobs_postmeta...');
  const postMetaRows = parseTable(fullText, 'jobs_postmeta');
  console.log(`  -> ${postMetaRows.length.toLocaleString()} rows`);

  // Build lookup maps, same structure as the original script
  const usersMap = new Map<string, any>();
  for (const row of userRows) {
    // (ID, user_login, user_pass, user_nicename, user_email, user_url, user_registered, user_activation_key, user_status, display_name)
    const [id, user_login, user_pass, , user_email, , user_registered, , , display_name] = row;
    if (!id) continue;
    usersMap.set(id as string, {
      legacyId: id,
      user_login: user_login || '',
      user_pass: user_pass || '',
      user_email: user_email || '',
      user_registered: user_registered || '',
      display_name: display_name || '',
    });
  }

  const userMetaMap = new Map<string, Record<string, string>>();
  for (const row of userMetaRows) {
    // (umeta_id, user_id, meta_key, meta_value)
    const [, userId, key, val] = row;
    if (!userId || !key) continue;
    if (!userMetaMap.has(userId as string)) userMetaMap.set(userId as string, {});
    userMetaMap.get(userId as string)![key as string] = (val as string) ?? '';
  }

  const postMetaMap = new Map<string, Record<string, string>>();
  const postToUserCandidate = new Map<string, string>();
  const postToUserEmployer = new Map<string, string>();
  for (const row of postMetaRows) {
    // (meta_id, post_id, meta_key, meta_value)
    const [, postId, key, val] = row;
    if (!postId || !key) continue;
    if (!postMetaMap.has(postId as string)) postMetaMap.set(postId as string, {});
    postMetaMap.get(postId as string)![key as string] = (val as string) ?? '';

    if (key === '_candidate_user_id') postToUserCandidate.set(postId as string, val as string);
    else if (key === '_employer_user_id') postToUserEmployer.set(postId as string, val as string);
  }

  console.log('Mapping and formatting data...');
  const results: any[] = [];

  for (const [legacyId, userData] of usersMap.entries()) {
    const usermeta = userMetaMap.get(legacyId) || {};

    let passwordHash = userData.user_pass;
    if (passwordHash.startsWith('$wp$2y$')) {
      passwordHash = passwordHash.replace('$wp$2y$', '$2y$');
    }

    let telegramId: string | null = null;
    if (userData.user_login.startsWith('tg_')) {
      telegramId = userData.user_login.substring(3);
    }

    const roleString = usermeta['jobs_capabilities'] || '';
    let role = 'JOB_SEEKER';
    if (roleString.includes('wp_job_board_pro_employer')) role = 'EMPLOYER';
    else if (roleString.includes('administrator')) role = 'ADMIN';

    const outputUser: any = {
      id: uuidv4(),
      email: userData.user_email,
      passwordHash,
      firstName: usermeta['first_name'] || userData.display_name.split(' ')[0] || '',
      lastName: usermeta['last_name'] || userData.display_name.split(' ').slice(1).join(' ') || '',
      role,
      telegramId,
      createdAt: userData.user_registered ? new Date(userData.user_registered).toISOString() : null,
      legacyUserId: legacyId,
    };

    for (const [postId, pUserId] of postToUserCandidate.entries()) {
      if (pUserId === legacyId) {
        const pm = postMetaMap.get(postId) || {};
        if (pm['_candidate_description']) outputUser.bio = pm['_candidate_description'];
        if (pm['_candidate_phone']) outputUser.phone = pm['_candidate_phone'];
        if (pm['_candidate_location']) outputUser.location = pm['_candidate_location'];
        if (pm['_candidate_job_title'] || pm['_candidate_title']) outputUser.headline = pm['_candidate_job_title'] || pm['_candidate_title'];
        if (pm['_candidate_cv_attachment']) outputUser.defaultResumeUrl = pm['_candidate_cv_attachment'];
        if (pm['_candidate_featured_image']) outputUser.avatarUrl = pm['_candidate_featured_image'];
        break;
      }
    }

    let companyData: any = null;
    for (const [postId, pUserId] of postToUserEmployer.entries()) {
      if (pUserId === legacyId) {
        const pm = postMetaMap.get(postId) || {};
        companyData = {
          id: uuidv4(),
          name: pm['_employer_display_name'] || userData.display_name,
          phone: pm['_employer_phone'] || '',
          legacyPostId: postId,
        };
        break;
      }
    }

    if (companyData) {
      outputUser.company = companyData;
      if (!outputUser.phone && companyData.phone) outputUser.phone = companyData.phone;
    }

    results.push(outputUser);
  }

  console.log(`Successfully mapped ${results.length.toLocaleString()} users.`);

  const roleCounts: Record<string, number> = {};
  for (const u of results) roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
  console.log('Role breakdown:', roleCounts);
  console.log('Users with company data:', results.filter((u) => u.company).length);
  console.log('Users with Telegram ID:', results.filter((u) => u.telegramId).length);

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Exported data to ${outputPath}`);
}

exportUsers().catch(console.error);
