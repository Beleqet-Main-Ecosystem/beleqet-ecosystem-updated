import '@testing-library/jest-dom';

/**
 * jsdom (Jest's DOM environment) doesn't implement `window.matchMedia`,
 * which `next-themes` relies on to detect the OS `prefers-color-scheme`
 * for the "system" preference. This minimal polyfill provides just enough
 * of the interface for next-themes to run in tests, defaulting to "light".
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function () {},
      removeListener: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {
        return false;
      },
    };
  };
}
