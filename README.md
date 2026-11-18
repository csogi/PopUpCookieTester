# Browser Check: Pop-ups and Cookies

A small static web page that tells a user (or the help desk) whether their browser allows:

1. **Pop-ups** from the site
2. **Cookies** for the site
3. **Site storage** (localStorage / sessionStorage)
4. **Third-party cookies**: a frame from another website using its own cookies, the way embedded sign-ins, LMS tools, and payment forms do
5. **Pop-ups to another website**: the way many sign-in windows open

It shows the browser and OS, explains each failure in plain language, links to per-browser fix steps, and has a **Copy results** button that produces a text summary for a support ticket.

No build step, no dependencies, no analytics. Test cookies are deleted as soon as each check finishes.

## How it works

Third-party tests need a **second website on a different registrable domain** (“site”). A different subdomain or port on the same domain does not count. This repo is designed to be published twice; each copy uses the other as its third-party site:

```
Site A  https://csogi.github.io/PopUpCookieTester/              ← test page + probes
Site B  https://scf-browsercheck.github.io/PopUpCookieTester/   ← test page + probes
```

Open either one: it loads `probe/cookie.html` (in a frame) and `probe/popup.html` (in a pop-up) from the other one. `github.io` is on the Public Suffix List, so two different GitHub accounts or organizations are two different sites.

The third-party cookie probe reports one of three results:

| Result | Meaning |
|---|---|
| **Allowed** | The frame can read and write its normal cookies. |
| **Blocked, except separate per-site cookies** | The frame only gets a separate cookie jar for this embedding site, which is how Firefox Total Cookie Protection and Chrome's “Block third-party cookies” setting work. `document.hasStorageAccess()` returns false. Embedded sign-ins usually fail. |
| **Blocked** | The frame cannot use cookies at all (Safari's default). |

When access is limited, the frame shows an **Allow access** button that calls the Storage Access API, so you can see whether the browser will grant permission.

## Files

| File | Purpose |
|---|---|
| `index.html` | The test page |
| `assets/app.js`, `assets/app.css` | Test logic and styles |
| `config.js` | **The only file you normally edit.** List of sites where this repo is published |
| `probe/cookie.html` | Loaded in a cross-site frame; tests cookies and reports back |
| `probe/popup.html` | Opened as a cross-site pop-up; confirms it loaded |
| `browsercheck.html` | Redirects old links to `index.html` |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

## Hosting on GitHub Pages (free)

You need two GitHub Pages sites owned by **different** accounts or organizations. Use your personal account for one, and a free GitHub organization for the other. (Two repos under the same account share one `csogi.github.io` site, so they don't count as third-party to each other.)

### 1. Publish site A from your repo

1. Push this code to the `main` branch of `csogi/PopUpCookieTester`. The repo must be **public** for Pages on a free plan.
2. In the repo, go to **Settings › Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, then set **Branch** to `main` and the folder to `/ (root)`. Select **Save**.
4. Wait a minute or two. The page will be at **https://csogi.github.io/PopUpCookieTester/**, and the Pages settings screen shows the link once it is live.

### 2. Create a free organization for site B

1. Go to **https://github.com/account/organizations/new** and choose the **Free** plan.
2. Pick a name, for example `scf-browsercheck`. It becomes part of the URL (`scf-browsercheck.github.io`), so choose something you're happy for users to see. If you want SCF to own it long-term, add a colleague as a second owner.

### 3. Publish site B from a fork

1. Open `csogi/PopUpCookieTester` and select **Fork**. Set **Owner** to the new organization, keep the repository name, and create the fork.
2. In the fork, go to **Settings › Pages** and repeat step 1.3 (`main`, `/ (root)`, **Save**).
3. Site B will be at **https://scf-browsercheck.github.io/PopUpCookieTester/**.

### 4. Point the two sites at each other

Edit `config.js` in **your** repo so both URLs are listed exactly as published (with the trailing slash):

```js
window.BROWSERCHECK_CONFIG = {
  sites: [
    "https://csogi.github.io/PopUpCookieTester/",
    "https://scf-browsercheck.github.io/PopUpCookieTester/"
  ]
};
```

Commit, then open the fork and select **Sync fork › Update branch** so site B gets the same config. **Do this every time you change the main repo**, or the two copies drift apart.

### 5. Check it

Open site A and select **Run all tests**, then **Test third-party pop-up**. “Third-party test site” should show site B's address, and all five checks should report a result. Then open site B and confirm it uses site A as its partner.

If test 4 says “No response from the test frame”, the URLs in `config.js` usually don't match where the sites are actually published, or the fork hasn't been synced.

### Optional: a friendlier address

You can give site A a custom domain such as `browsercheck.scf.edu`:

1. In the repo, go to **Settings › Pages › Custom domain**, enter the domain, and save. This adds a `CNAME` file to the repo.
2. Have DNS add a `CNAME` record from `browsercheck.scf.edu` to `csogi.github.io`.
3. When the certificate is issued, turn on **Enforce HTTPS**.
4. Replace site A's URL in `config.js` with `https://browsercheck.scf.edu/`, then sync the fork.
5. Recommended: verify the domain in your account or organization settings (**Settings › Pages › Add a domain**) so no one else can claim it.

Site B stays on `github.io`, which is still a different site from `scf.edu`, so the third-party tests keep working.

## Local development

Serve the folder and use `localhost` and `127.0.0.1` as the two sites:

```bash
python3 -m http.server 8000
```

Temporarily set `config.js` to:

```js
sites: ["http://localhost:8000/", "http://127.0.0.1:8000/"]
```

Then open `http://localhost:8000/`. Chrome treats both hosts as secure contexts. Note that some browsers relax cookie rules for localhost, so do the final testing on the real HTTPS sites.

## Limitations

- **Pop-up results only cover pop-ups opened by a click.** Most browsers allow those by default and only block pop-ups that a script opens on its own. A “Blocked” result usually means a strict setting or an extension.
- **Results apply to this pair of sites.** Users who already allowed a specific service (for example, a site exception for the LMS) may see different behavior there.
- **Storage Access API rules differ by browser.** Chrome and Safari only grant access after the user has visited the third-party site directly. Test 5's pop-up counts as that visit once the user selects **Close** in it.
- **Browser detection reads the user-agent string.** It is good enough for a support ticket, but it isn't guaranteed to be exact.
