/*
 * Browser Check — site configuration
 * -----------------------------------
 * List every place this repo is published. Each entry is the full base URL
 * (with trailing slash) of a copy of this site.
 *
 * The test page picks the first entry whose host is DIFFERENT from the host
 * it is running on and loads its probes from there. That makes every copy a
 * mirror: either one can be the "main" page, and the other acts as the
 * third-party site.
 *
 * For a real third-party test the two hosts must be different *sites*
 * (different registrable domains). Two GitHub Pages sites owned by different
 * accounts/organizations qualify, because github.io is on the Public Suffix
 * List: csogi.github.io and scf-browsercheck.github.io are separate sites.
 *
 * Probes only send results back to pages listed here.
 */
window.BROWSERCHECK_CONFIG = {
  sites: [
    "https://csogi.github.io/PopUpCookieTester/",
    "https://scf-browsercheck.github.io/PopUpCookieTester/"

    // Local development (serve the folder with: python3 -m http.server 8000)
    // ,"http://localhost:8000/"
    // ,"http://127.0.0.1:8000/"
  ]
};
