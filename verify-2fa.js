const BASE = 'http://localhost:4000/api/v1';
const { generate } = require('otplib');

async function request(method, path, body, token, extraHeaders) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  try { const data = await res.json(); return { status: res.status, data }; }
  catch { return { status: res.status, data: {} }; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForNextTimeStep() {
  const now = Math.floor(Date.now() / 1000);
  const nextStep = (Math.floor(now / 30) + 1) * 30;
  const waitMs = (nextStep - now) * 1000 + 500;
  if (waitMs > 100) {
    console.log(`  Waiting ${Math.ceil(waitMs/1000)}s for next TOTP time step...`);
    await sleep(waitMs);
  }
}

async function main() {
  const email = `v-${Date.now()}@example.com`;
  const password = 'Test123!';
  const newPassword = 'NewPass-456!';
  const newEmail = `v2-${Date.now()}@example.com`;
  const r = {};

  // 2a. Register
  const reg = await request('POST', '/auth/register', { email, password, firstName: 'V', lastName: 'T', role: 'FREELANCER' });
  r['2a. Register'] = reg.status === 201 ? 'PASS' : 'FAIL'; console.log(`2a. ${r['2a. Register']}`);
  if (reg.status !== 201) return; const token = reg.data.accessToken;

  // 2b. Enroll
  const enroll = await request('POST', '/auth/2fa/enroll', null, token);
  r['2b. Enroll'] = enroll.status === 201 ? 'PASS' : 'FAIL'; console.log(`2b. ${r['2b. Enroll']}`);
  if (enroll.status !== 201) return; const secret = enroll.data.secret;

  // 2d. Confirm enrollment
  const codeEnroll = await generate({ secret });
  const confirm = await request('POST', '/auth/2fa/confirm', { enrollmentToken: enroll.data.enrollmentToken, code: codeEnroll }, token);
  r['2d. Confirm enrollment'] = confirm.status === 201 ? 'PASS' : 'FAIL';
  console.log(`2d. ${r['2d. Confirm enrollment']} codes=${confirm.data.backupCodes?.length}`);
  if (confirm.status !== 201) return; const backupCode = confirm.data.backupCodes[0];

  // 3. Login with 2FA
  await waitForNextTimeStep();
  const codeLogin = await generate({ secret });
  const login1 = await request('POST', '/auth/login', { email, password });
  r['3. Login challenge'] = login1.data.requires2fa ? 'PASS' : 'FAIL'; console.log(`3. requires2fa=${login1.data.requires2fa}`);

  const vfy = await request('POST', '/auth/2fa/verify', { tempToken: login1.data.tempToken, code: codeLogin });
  r['3. Login verify'] = vfy.status === 200 ? 'PASS' : 'FAIL';
  console.log(`   Verify: ${vfy.status} ${vfy.status !== 200 ? JSON.stringify(vfy.data) : 'OK'}`);
  if (vfy.status !== 200) return; const accessToken = vfy.data.accessToken;

  // 4. Replay detection
  const login1b = await request('POST', '/auth/login', { email, password });
  const replay = await request('POST', '/auth/2fa/verify', { tempToken: login1b.data.tempToken, code: codeLogin });
  r['4. Replay detection'] = replay.status === 401 ? 'PASS' : 'FAIL';
  console.log(`4. Replay: ${replay.status} msg=${replay.data.message}`);
  try {
    const { execSync } = require('child_process');
    const keys = execSync('redis-cli --raw keys "2fa:used:*" 2>/dev/null').toString().trim();
    console.log(`   Redis keys: ${keys ? keys.split('\n').length : 0}`);
  } catch(e) { console.log(`   Redis: ${e.message.substring(0,40)}`); }

  // 5. Step-up on wallet withdraw
  const wd1 = await request('POST', '/wallet/withdraw', { amount: 100 }, accessToken);
  r['5a. Step-up challenge'] = wd1.data?.requiresStepUp ? 'PASS' : 'FAIL';
  console.log(`5a. Withdraw: ${wd1.status} requiresStepUp=${!!wd1.data?.requiresStepUp}`);

  let stepUpTok;
  if (wd1.data?.stepUpToken) {
    await waitForNextTimeStep();
    const codeSu = await generate({ secret });
    const su = await request('POST', '/auth/2fa/step-up', { stepUpToken: wd1.data.stepUpToken, code: codeSu });
    r['5b. Step-up verify'] = su.status === 200 ? 'PASS' : 'FAIL';
    console.log(`5b. Step-up: ${su.status} ${su.status !== 200 ? JSON.stringify(su.data) : 'OK'}`);
    if (su.status === 200) stepUpTok = su.data.stepUpToken;
  }

  if (stepUpTok) {
    const wd2 = await request('POST', '/wallet/withdraw', { amount: 100 }, accessToken, { 'x-step-up-token': stepUpTok });
    const guardPassed = wd2.status !== 401 && wd2.status !== 403;
    r['5c. Withdraw with step-up'] = guardPassed ? 'PASS' : 'FAIL';
    console.log(`5c. Withdraw: ${wd2.status} guard=${guardPassed ? 'passed' : 'blocked'}`);
  }

  // 6. Purpose confusion (runs BEFORE password change so temp tokens are still valid)
  const wrongPurp = await request('POST', '/auth/2fa/step-up', { stepUpToken: login1.data.tempToken, code: codeLogin });
  r['6a. Login token→/step-up'] = wrongPurp.status === 400 ? 'PASS' : 'FAIL';
  console.log(`6a. Login→step-up: ${wrongPurp.status}`);

  const chall = await request('POST', '/auth/2fa/challenge', { action: 'wallet_withdraw' }, token);
  if (chall.status >= 200 && chall.status < 300) {
    const we = await request('POST', '/auth/2fa/verify', { tempToken: chall.data.stepUpToken, code: codeLogin });
    r['6b. Challenge→/verify'] = we.status === 401 ? 'PASS' : 'FAIL';
    console.log(`6b. Challenge→verify: ${we.status}`);

    const sc = await request('POST', '/auth/2fa/challenge', { action: 'milestone_release', resourceId: 'ms-1' }, token);
    const mm = await request('POST', '/auth/2fa/step-up', { stepUpToken: sc.data.stepUpToken, code: codeLogin, action: 'wallet_withdraw' });
    r['6c. Scope mismatch'] = mm.status === 400 ? 'PASS' : 'FAIL';
    console.log(`6c. Scope mismatch: ${mm.status}`);

    const wr = await request('POST', '/auth/2fa/backup-codes/regenerate', { stepUpToken: login1.data.tempToken, code: codeLogin }, token);
    r['6d. Wrong purpose regen'] = wr.status === 400 ? 'PASS' : 'FAIL';
    console.log(`6d. Login→regenerate: ${wr.status}`);
  }

  // 7. Backup code (runs BEFORE password change so login still works with old password)
  const login2 = await request('POST', '/auth/login', { email, password });
  if (login2.data?.tempToken) {
    const bc = await request('POST', '/auth/2fa/backup-code', { tempToken: login2.data.tempToken, backupCode });
    r['7a. Backup code login'] = bc.status === 200 ? 'PASS' : 'FAIL';
    console.log(`7a. Backup login: ${bc.status} remaining=${bc.data?.remainingBackupCodes}`);

    const login3 = await request('POST', '/auth/login', { email, password });
    if (login3.data?.tempToken) {
      const bc2 = await request('POST', '/auth/2fa/backup-code', { tempToken: login3.data.tempToken, backupCode });
      r['7b. Backup reuse'] = bc2.status === 401 ? 'PASS' : 'FAIL';
      console.log(`7b. Backup reuse: ${bc2.status}`);
    } else {
      r['7b. Backup reuse'] = 'SKIP'; console.log('7b. Backup reuse: SKIP (login failed)');
    }
  } else {
    r['7a. Backup code login'] = 'SKIP'; console.log('7a. Backup login: SKIP (login failed)');
  }

  // 8. i18n
  const i18n = await request('POST', '/auth/2fa/verify', { tempToken: 'bad', code: '000000' });
  r['8. i18n resolves'] = typeof i18n.data.message === 'string' ? 'PASS' : 'FAIL';
  console.log(`8. i18n: "${i18n.data.message}"`);

  // 9. Password change (with step-up)
  if (stepUpTok) {
    const cp1 = await request('POST', '/auth/change-password', { currentPassword: password, newPassword }, accessToken);
    r['9a. PW change requires step-up'] = cp1.data?.requiresStepUp ? 'PASS' : 'FAIL';
    console.log(`9a. PW change (no header): ${cp1.status} requiresStepUp=${!!cp1.data?.requiresStepUp}`);

    const cp2 = await request('POST', '/auth/change-password', { currentPassword: password, newPassword }, accessToken, { 'x-step-up-token': stepUpTok });
    r['9b. PW change with step-up'] = cp2.status === 200 ? 'PASS' : 'FAIL';
    console.log(`9b. PW change (with header): ${cp2.status} ${cp2.status !== 200 ? JSON.stringify(cp2.data) : 'OK'}`);

    // 10. Email change — uses newPassword since step 9b changed it
    const ce1 = await request('POST', '/auth/change-email', { newEmail, password: newPassword }, accessToken);
    r['10a. Email change requires step-up'] = ce1.data?.requiresStepUp ? 'PASS' : 'FAIL';
    console.log(`10a. Email change (no header): ${ce1.status} requiresStepUp=${!!ce1.data?.requiresStepUp}`);

    const ce2 = await request('POST', '/auth/change-email', { newEmail, password: newPassword }, accessToken, { 'x-step-up-token': stepUpTok });
    r['10b. Email change with step-up'] = ce2.status === 200 ? 'PASS' : 'FAIL';
    console.log(`10b. Email change (with header): ${ce2.status} ${ce2.status !== 200 ? JSON.stringify(ce2.data) : 'OK'}`);
  }

  // ---- No-2FA tests with a second user ----
  const emailNo2fa = `v-no2fa-${Date.now()}@example.com`;
  const reg2 = await request('POST', '/auth/register', { email: emailNo2fa, password, firstName: 'N', lastName: 'O', role: 'FREELANCER' });
  if (reg2.status === 201) {
    const tok2 = reg2.data.accessToken;

    const cp3 = await request('POST', '/auth/change-password', { currentPassword: password, newPassword }, tok2);
    r['9c. PW change no 2FA'] = cp3.status === 200 ? 'PASS' : 'FAIL';
    console.log(`9c. PW change no 2FA: ${cp3.status} ${cp3.status !== 200 ? JSON.stringify(cp3.data) : 'OK'}`);

    const ce3 = await request('POST', '/auth/change-email', { newEmail: `v-no2fa-new-${Date.now()}@example.com`, password: newPassword }, tok2);
    r['10c. Email change no 2FA'] = ce3.status === 200 ? 'PASS' : 'FAIL';
    console.log(`10c. Email change no 2FA: ${ce3.status} ${ce3.status !== 200 ? JSON.stringify(ce3.data) : 'OK'}`);
  }

  // Results
  console.log('\n=== RESULTS ===');
  let p = 0, f = 0, s = 0;
  Object.entries(r).forEach(([label,status]) => {
    const icon = status === 'PASS' ? '✓' : status === 'SKIP' ? '○' : '✗';
    console.log(`  ${icon} ${label}: ${status}`);
    if (status === 'PASS') p++;
    else if (status === 'FAIL') f++;
    else s++;
  });
  console.log(`\n${p} passed, ${f} failed, ${s} skipped`);
  process.exit(f > 0 ? 1 : 0);
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
