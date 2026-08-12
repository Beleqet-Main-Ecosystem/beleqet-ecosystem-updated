import * as fs from 'fs';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

async function exportUsers() {
  // Get paths from command line arguments, default to local files
  const sqlDumpPath = process.argv[2] || 'beleqend_jobs.sql';
  const outputPath = process.argv[3] || 'users-migration.json';
  
  if (!fs.existsSync(sqlDumpPath)) {
    console.error(`Error: SQL dump not found at ${sqlDumpPath}`);
    console.log(`Usage: npx ts-node scripts/export-wp-users.ts [path/to/database.sql] [path/to/output.json]`);
    return;
  }

  console.log('Starting export process...');
  
  // Data structures
  const usersMap = new Map<string, any>(); // legacy_user_id -> User details
  const userMetaMap = new Map<string, any>(); // legacy_user_id -> Meta keys
  
  const postMetaMap = new Map<string, any>(); // post_id -> Meta keys
  const postToUserCandidate = new Map<string, string>(); // post_id -> user_id
  const postToUserEmployer = new Map<string, string>(); // post_id -> user_id

  let currentSection = '';

  const rl = readline.createInterface({
    input: fs.createReadStream(sqlDumpPath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  // Simple string unescaping for basic values
  const unescapeSql = (str: string) => {
    return str.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  };

  console.log('Pass 1: Parsing SQL Dump...');

  for await (const line of rl) {
    if (line.includes('INSERT INTO `jobs_users`')) {
      currentSection = 'users';
      continue;
    } else if (line.includes('INSERT INTO `jobs_usermeta`')) {
      currentSection = 'usermeta';
      continue;
    } else if (line.includes('INSERT INTO `jobs_postmeta`')) {
      currentSection = 'postmeta';
      continue;
    } else if (currentSection && line.startsWith('INSERT INTO')) {
      currentSection = '';
    }

    if (currentSection === 'users' && line.startsWith('(')) {
      // (ID, user_login, user_pass, user_nicename, user_email, user_url, user_registered, user_activation_key, user_status, display_name)
      // We'll use a regex that handles basic string quoting, though full SQL parsing is complex.
      // Easiest is to split by `', '` since most strings are single quoted.
      // Format: (1, 'admin_og5mqgqq', '$wp$2y$10$...', 'admin_og5mqgqq', 'admin@beleqet.com', 'url', '2025-01-25 07:03:36', '', 0, 'admin')
      const match = line.match(/^\((\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*'([^']*)'/);
      if (match) {
        const id = match[1];
        usersMap.set(id, {
          legacyId: id,
          user_login: unescapeSql(match[2]),
          user_pass: unescapeSql(match[3]),
          user_email: unescapeSql(match[5]),
          user_registered: match[7],
          display_name: unescapeSql(match[10])
        });
      }
    } else if (currentSection === 'usermeta' && line.startsWith('(')) {
      // (umeta_id, user_id, meta_key, meta_value)
      const match = line.match(/^\(\d+,\s*(\d+),\s*'([^']+)',\s*'(.*)'\),?$/);
      if (match) {
        const userId = match[1];
        const key = unescapeSql(match[2]);
        let val = match[3];
        // Strip trailing '); or ),' if it got caught
        val = val.replace(/'\),?$/, '');
        val = unescapeSql(val);
        
        if (!userMetaMap.has(userId)) userMetaMap.set(userId, {});
        userMetaMap.get(userId)[key] = val;
      }
    } else if (currentSection === 'postmeta' && line.startsWith('(')) {
      // (meta_id, post_id, meta_key, meta_value)
      const match = line.match(/^\(\d+,\s*(\d+),\s*'([^']+)',\s*'(.*)'\),?$/);
      if (match) {
        const postId = match[1];
        const key = unescapeSql(match[2]);
        let val = match[3];
        val = val.replace(/'\),?$/, '');
        val = unescapeSql(val);

        if (!postMetaMap.has(postId)) postMetaMap.set(postId, {});
        postMetaMap.get(postId)[key] = val;

        if (key === '_candidate_user_id') {
          postToUserCandidate.set(postId, val);
        } else if (key === '_employer_user_id') {
          postToUserEmployer.set(postId, val);
        }
      }
    }
  }

  console.log('Pass 2: Mapping and Formatting Data...');

  const results = [];

  for (const [legacyId, userData] of usersMap.entries()) {
    const usermeta = userMetaMap.get(legacyId) || {};
    
    // Convert WordPress Hash: $wp$2y$10$ -> $2y$10$
    let passwordHash = userData.user_pass;
    if (passwordHash.startsWith('$wp$2y$')) {
      passwordHash = passwordHash.replace('$wp$2y$', '$2y$');
    }

    let telegramId = null;
    if (userData.user_login.startsWith('tg_')) {
      telegramId = userData.user_login.substring(3);
    }

    const roleString = usermeta['jobs_capabilities'] || '';
    let role = 'JOB_SEEKER'; // default
    if (roleString.includes('wp_job_board_pro_employer')) role = 'EMPLOYER';
    else if (roleString.includes('administrator')) role = 'ADMIN';

    const outputUser: any = {
      id: uuidv4(),
      email: userData.user_email,
      passwordHash: passwordHash,
      firstName: usermeta['first_name'] || userData.display_name.split(' ')[0] || '',
      lastName: usermeta['last_name'] || userData.display_name.split(' ').slice(1).join(' ') || '',
      role: role,
      telegramId: telegramId,
      createdAt: new Date(userData.user_registered).toISOString(),
      legacyUserId: legacyId,
    };

    // Deep merge postmeta for this user
    for (const [postId, pUserId] of postToUserCandidate.entries()) {
      if (pUserId === legacyId) {
        const pm = postMetaMap.get(postId);
        if (pm['_candidate_description']) outputUser.bio = pm['_candidate_description'];
        if (pm['_candidate_phone']) outputUser.phone = pm['_candidate_phone'];
        if (pm['_candidate_location']) outputUser.location = pm['_candidate_location'];
        if (pm['_candidate_job_title'] || pm['_candidate_title']) outputUser.headline = pm['_candidate_job_title'] || pm['_candidate_title'];
        if (pm['_candidate_cv_attachment']) outputUser.defaultResumeUrl = pm['_candidate_cv_attachment']; // Usually an ID or URL
        if (pm['_candidate_featured_image']) outputUser.avatarUrl = pm['_candidate_featured_image']; // Usually an ID or URL
        break;
      }
    }

    let companyData = null;
    for (const [postId, pUserId] of postToUserEmployer.entries()) {
      if (pUserId === legacyId) {
        const pm = postMetaMap.get(postId);
        companyData = {
          id: uuidv4(),
          name: pm['_employer_display_name'] || userData.display_name,
          phone: pm['_employer_phone'] || '',
          legacyPostId: postId
        };
        break;
      }
    }

    if (companyData) {
      outputUser.company = companyData;
      // also grab phone for user if not set
      if (!outputUser.phone && companyData.phone) {
        outputUser.phone = companyData.phone;
      }
    }

    results.push(outputUser);
  }

  console.log(`Successfully mapped ${results.length} users.`);
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Exported data to ${outputPath}`);
}

exportUsers().catch(console.error);
