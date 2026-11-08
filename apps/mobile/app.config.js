/**
 * app.json plus the Firebase file Android push needs. The file isn't committed (the repo is
 * public): EAS builds get it from the GOOGLE_SERVICES_JSON file variable on expo.dev, and a local
 * build uses ./google-services.json when it's there.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
