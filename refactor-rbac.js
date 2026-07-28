const fs = require('fs');
const path = require('path');

const files = [
  { file: 'src/modules/subscriptions/subscriptions.controller.ts', perm: 'manage:billing' },
  { file: 'src/modules/plans/plans.controller.ts', perm: 'manage:billing' },
  { file: 'src/modules/payments/payments.controller.ts', perm: 'manage:billing' },
  { file: 'src/modules/kyc/kyc.controller.ts', perm: 'manage:kyc' },
  { file: 'src/modules/jobs/jobs.controller.ts', perm: 'create:jobs' },
  { file: 'src/modules/db-index-master/db-index-master.controller.ts', perm: 'manage:db' },
  { file: 'src/modules/dispute-manager/dispute-manager.controller.ts', perm: 'manage:disputes' },
  { file: 'src/modules/admin-stats/admin-stats.controller.ts', perm: 'view:stats' },
  { file: 'src/modules/admin/admin.controller.ts', perm: 'manage:users' },
];

for (const { file: p, perm } of files) {
  const fullPath = path.join(__dirname, p);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Add imports
  if (!content.includes('RequirePermissions')) {
    // Find the last import
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    
    // Determine relative path based on directory depth
    // All these are in src/modules/<module>/<file>.ts -> depth is 2 from src
    // So relative to src/common is ../../common
    const imports = `\nimport { RequirePermissions } from '../../common/decorators/permissions.decorator';\nimport { PermissionsGuard } from '../../common/guards/permissions.guard';`;
    content = content.slice(0, endOfLastImport) + imports + content.slice(endOfLastImport);
  }
  
  // Add PermissionsGuard to UseGuards
  content = content.replace(/@UseGuards\((.*?RolesGuard.*?)\)/g, (match, p1) => {
    if (p1.includes('PermissionsGuard')) return match;
    return `@UseGuards(${p1}, PermissionsGuard)`;
  });

  // Replace @Roles with @Roles and @RequirePermissions
  // We use regex to find @Roles and insert @RequirePermissions right after it
  // But we need to avoid doing it if it's already there
  let newContent = '';
  let index = 0;
  const rolesRegex = /@Roles\((.*?)\)/g;
  let match;
  
  while ((match = rolesRegex.exec(content)) !== null) {
    newContent += content.substring(index, match.index + match[0].length);
    const nextText = content.substring(match.index + match[0].length, match.index + match[0].length + 30);
    if (!nextText.includes('@RequirePermissions')) {
      newContent += `\n  @RequirePermissions('${perm}')`;
    }
    index = match.index + match[0].length;
  }
  newContent += content.substring(index);
  
  fs.writeFileSync(fullPath, newContent);
  console.log(`Updated ${p}`);
}
