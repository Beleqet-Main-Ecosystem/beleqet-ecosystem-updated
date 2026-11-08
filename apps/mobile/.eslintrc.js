// The app's own lint rules (Expo's), so the backend's config at the repo root doesn't apply here.
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'android/', '.expo/', 'dist/', 'scripts/'],
};
