/* Browser Check — main page logic. No dependencies, no tracking. */
(function () {
  "use strict";

  // ---------- Configuration ----------
  var cfg = window.BROWSERCHECK_CONFIG || { sites: [] };
  var sites = (cfg.sites || []).map(function (s) {
    try { return new URL(s); } catch (e) { return null; }
  }).filter(Boolean);

  // The partner (third-party) site is the first configured site on a different host.
  var partner = sites.filter(function (u) { return u.hostname !== location.hostname; })[0] || null;
  var partnerOrigin = partner ? partner.origin : null;

  function partnerUrl(path, params) {
    var u = new URL(path, partner.href);
    Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
    u.searchParams.set("t", String(Date.now()));
    return u.href;
  }

  // ---------- Status rendering ----------
  var results = {}; // key -> { state, label, advice }
  var TITLES = {
    popup: "Pop-ups",
    cookies1p: "Cookies for this site",
    storage1p: "Site storage",
    cookies3p: "Third-party cookies",
    popup3p: "Pop-up to another website"
  };

  function setResult(key, state, label, advice) {
    results[key] = { state: state, label: label, advice: advice || "" };
    var card = document.getElementById("test-" + key);
    var status = card.querySelector(".status");
    status.dataset.state = state;
    status.querySelector(".label").textContent = label;
    var adv = card.querySelector(".advice");
    adv.textContent = advice || "";
    adv.hidden = !advice;
  }

  function $(id) { return document.getElementById(id); }

  // ---------- Environment ----------
  function detectBrowser() {
    var ua = navigator.userAgent;
    var m;
    var browser = "Unknown browser";
    if ((m = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/))) browser = "Microsoft Edge " + m[1];
    else if ((m = ua.match(/OPR\/([\d.]+)/))) browser = "Opera " + m[1];
    else if ((m = ua.match(/SamsungBrowser\/([\d.]+)/))) browser = "Samsung Internet " + m[1];
    else if ((m = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/))) browser = "Firefox " + m[1];
    else if ((m = ua.match(/CriOS\/([\d.]+)/))) browser = "Chrome (iOS) " + m[1];
    else if ((m = ua.match(/Chrome\/([\d.]+)/))) browser = "Chrome " + m[1];
    else if (/Safari\//.test(ua) && (m = ua.match(/Version\/([\d.]+)/))) browser = "Safari " + m[1];
    if (navigator.brave) browser = browser.replace(/^Chrome/, "Brave (Chromium)");

    var os = "Unknown";
    if (/Windows NT 10/.test(ua)) os = "Windows 10 or 11";
    else if (/Windows/.test(ua)) os = "Windows";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS / iPadOS " + ((ua.match(/OS ([\d_]+)/) || [, ""])[1].replace(/_/g, "."));
    else if (/Macintosh/.test(ua)) os = navigator.maxTouchPoints > 1 ? "iPadOS (desktop mode)" : "macOS";
    else if (/Android/.test(ua)) os = "Android " + ((ua.match(/Android ([\d.]+)/) || [, ""])[1]);
    else if (/CrOS/.test(ua)) os = "ChromeOS";
    else if (/Linux/.test(ua)) os = "Linux";
    return { browser: browser, os: os };
  }

  var env = detectBrowser();

  function renderEnv() {
    $("envBrowser").textContent = env.browser;
    $("envOS").textContent = env.os;
    $("envCookieEnabled").textContent = navigator.cookieEnabled ? "On" : "Off";
    $("envHere").textContent = location.origin;
    $("envPartner").textContent = partnerOrigin || "Not configured";

    // Chromium exposes accurate Windows 11 detection through client hints.
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(["platformVersion"]).then(function (h) {
        if (navigator.userAgentData.platform === "Windows" && h.platformVersion) {
          env.os = parseInt(h.platformVersion, 10) >= 13 ? "Windows 11" : "Windows 10";
          $("envOS").textContent = env.os;
        }
      }).catch(function () {});
    }
  }

  function checkConfig() {
    var notice = $("configNotice");
    var msgs = [];
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      msgs.push("This page should be opened over https://. Results on " + location.protocol + "// are not reliable.");
    }
    if (!partner) {
      msgs.push("No third-party test site is configured for " + location.host + ". Tests 4 and 5 are unavailable. Edit config.js.");
    } else if (partner.protocol !== "https:" && partner.hostname !== "localhost" && partner.hostname !== "127.0.0.1") {
      msgs.push("The third-party test site should use https://, or third-party cookie results will be wrong.");
    }
    if (msgs.length) { notice.textContent = msgs.join(" "); notice.hidden = false; }
    if (!partner) {
      document.querySelectorAll('[data-run="cookies3p"],[data-run="popup3p"]').forEach(function (b) { b.disabled = true; });
    }
  }

  // ---------- Test 1: pop-ups (same site) ----------
  function testPopup() {
    var w = null;
    try { w = window.open("", "bc_popup_test", "popup,width=380,height=220"); } catch (e) { w = null; }

    if (!w) {
      setResult("popup", "fail", "Blocked",
        "Your browser blocked the pop-up. Allow pop-ups for sites that need them (see “How to allow” below).");
      return;
    }
    try {
      w.document.title = "Pop-up test";
      w.document.body.style.cssText = "font:16px system-ui,sans-serif;margin:16px";
      w.document.body.textContent = "Pop-up test: this window opened successfully and will close on its own.";
    } catch (e) { /* ignore */ }

    setResult("popup", "running", "Opened, checking…");
    setTimeout(function () {
      if (w.closed) {
        setResult("popup", "fail", "Blocked (closed immediately)",
          "The window opened and was closed right away, usually by a pop-up blocker extension.");
        return;
      }
      setResult("popup", "pass", "Allowed");
      setTimeout(function () { try { w.close(); } catch (e) {} }, 1200);
    }, 400);
  }

  // ---------- Test 2: first-party cookies ----------
  function testCookies1p() {
    var name = "bc_1p_test", val = String(Date.now()) + Math.random().toString(36).slice(2, 8);
    var ok = false;
    try {
      document.cookie = name + "=" + val + "; Max-Age=60; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
      ok = document.cookie.indexOf(name + "=" + val) !== -1;
      document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    } catch (e) { ok = false; }

    if (ok) setResult("cookies1p", "pass", "Working");
    else setResult("cookies1p", "fail", "Blocked",
      "This browser is blocking all cookies" + (navigator.cookieEnabled ? "" : " (cookies are turned off in settings)") +
      ". Most sign-ins will fail until cookies are allowed.");
  }

  // ---------- Test 3: local/session storage ----------
  function testStorage1p() {
    function probe(store) {
      try {
        var s = window[store];
        var k = "bc_storage_test", v = String(Date.now());
        s.setItem(k, v);
        var ok = s.getItem(k) === v;
        s.removeItem(k);
        return ok;
      } catch (e) { return false; }
    }
    var local = probe("localStorage"), session = probe("sessionStorage");
    if (local && session) setResult("storage1p", "pass", "Working");
    else setResult("storage1p", "fail",
      "Blocked (" + [local ? null : "local storage", session ? null : "session storage"].filter(Boolean).join(" and ") + ")",
      "Site storage is unavailable. This usually means cookies and site data are blocked, or a private-browsing mode is restricting storage.");
  }

  // ---------- Test 4: third-party cookies (cross-site iframe) ----------
  var cookies3pPending = null; // { resolve, timer }

  function testCookies3p() {
    if (!partner) return Promise.resolve();
    setResult("cookies3p", "running", "Checking…");
    $("probeWrap").hidden = false;

    return new Promise(function (resolve) {
      if (cookies3pPending) { clearTimeout(cookies3pPending.timer); cookies3pPending.resolve(); }
      var timer = setTimeout(function () {
        cookies3pPending = null;
        setResult("cookies3p", "fail", "No response from the test frame",
          "The frame from " + partnerOrigin + " did not load or could not report back. A network filter, extension, or strict privacy setting may be blocking it.");
        resolve();
      }, 8000);
      cookies3pPending = { resolve: resolve, timer: timer };
      $("probeFrame").src = partnerUrl("probe/cookie.html", { parent: location.origin });
    });
  }

  function handleCookieResult(data) {
    var adv;
    if (data.verdict === "allowed") {
      setResult("cookies3p", "pass", "Allowed",
        data.granted ? "Access was granted for this test site. Embedded tools on other sites may still need their own permission." : "");
    } else if (data.verdict === "partitioned") {
      adv = "This browser gives embedded sites a separate set of cookies for each website they appear on " +
        "(for example Firefox Total Cookie Protection, or Chrome with third-party cookies blocked). " +
        "Embedded sign-ins may fail.";
      if (data.canRequest) adv += " Use the “Allow access” button in the frame below to test granting access.";
      setResult("cookies3p", "warn", "Blocked, except separate per-site cookies", adv);
    } else {
      adv = "Third-party cookies are blocked. Embedded tools that need them will fail unless the site is allowed in browser settings.";
      if (data.canRequest) adv += " You can also try the “Allow access” button in the frame below.";
      setResult("cookies3p", "fail", "Blocked", adv);
    }
    results.cookies3p.detail = data.detail || "";
    if (cookies3pPending) {
      clearTimeout(cookies3pPending.timer);
      var r = cookies3pPending.resolve;
      cookies3pPending = null;
      r();
    }
  }

  // ---------- Test 5: pop-up to another site ----------
  var popup3pAckTimer = null;

  function testPopup3p() {
    if (!partner) return;
    var url = partnerUrl("probe/popup.html", { opener: location.origin });
    $("popup3pLink").href = url;
    $("popup3pFallback").hidden = true;

    // No "noopener" here: with it, window.open() returns null even on success,
    // and the pop-up cannot report back.
    var w = null;
    try { w = window.open(url, "bc_popup3p_test", "popup,width=520,height=460"); } catch (e) { w = null; }

    if (!w) {
      setResult("popup3p", "fail", "Blocked",
        "Your browser blocked a pop-up to another website. Sign-in windows for some services will not open.");
      $("popup3pFallback").hidden = false;
      return;
    }

    setResult("popup3p", "running", "Opened, waiting for the other site to confirm…");
    clearTimeout(popup3pAckTimer);
    popup3pAckTimer = setTimeout(function () {
      if (results.popup3p && results.popup3p.state === "running") {
        var closed = false;
        try { closed = w.closed; } catch (e) {}
        if (closed) {
          setResult("popup3p", "fail", "Blocked (closed immediately)",
            "The window opened and was closed right away, usually by a pop-up blocker extension.");
          $("popup3pFallback").hidden = false;
        } else {
          setResult("popup3p", "warn", "Opened, but the other site did not confirm",
            "The window opened but its page did not finish loading or could not report back. Check the pop-up window for errors.");
        }
      }
    }, 6000);
  }

  // ---------- Messages from probes (origin-checked) ----------
  window.addEventListener("message", function (ev) {
    if (!partnerOrigin || ev.origin !== partnerOrigin) return;
    var d = ev.data;
    if (!d || typeof d !== "object") return;

    if (d.type === "bc-3pc-result" && ev.source === $("probeFrame").contentWindow) {
      handleCookieResult(d);
    } else if (d.type === "bc-popup-ack") {
      clearTimeout(popup3pAckTimer);
      setResult("popup3p", "pass", "Allowed");
      $("popup3pFallback").hidden = true;
    } else if (d.type === "bc-probe-resize" && ev.source === $("probeFrame").contentWindow) {
      var h = Math.max(80, Math.min(400, Number(d.height) || 150));
      $("probeFrame").style.height = h + "px";
    }
  });

  // ---------- Copy results ----------
  function summaryText() {
    var lines = [
      "Browser check results",
      "Date: " + new Date().toString(),
      "Browser: " + env.browser,
      "Operating system: " + env.os,
      "Cookies enabled setting: " + (navigator.cookieEnabled ? "On" : "Off"),
      "Test page: " + location.href.split("?")[0],
      "Third-party test site: " + (partnerOrigin || "not configured"),
      ""
    ];
    Object.keys(TITLES).forEach(function (k, i) {
      var r = results[k];
      lines.push((i + 1) + ". " + TITLES[k] + ": " + (r ? r.label : "Not checked"));
      if (r && r.detail) lines.push("   Detail: " + r.detail);
    });
    lines.push("", "User agent: " + navigator.userAgent);
    return lines.join("\n");
  }

  function copyResults() {
    var text = summaryText();
    var done = function (ok) {
      $("copyStatus").textContent = ok ? "Results copied. Paste them into your support request." : "Copy failed. Select and copy the text manually.";
      if (!ok) window.prompt("Copy these results:", text);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  // ---------- Run all ----------
  function runAll() {
    var btn = $("btnRunAll");
    btn.disabled = true;
    testPopup(); // must run first, directly inside the click
    testCookies1p();
    testStorage1p();
    testCookies3p().then(function () { btn.disabled = false; });
  }

  // ---------- Wire up ----------
  var runners = { popup: testPopup, cookies1p: testCookies1p, storage1p: testStorage1p, cookies3p: testCookies3p, popup3p: testPopup3p };
  document.querySelectorAll("[data-run]").forEach(function (b) {
    b.addEventListener("click", function () { runners[b.dataset.run](); });
  });
  $("btnRunAll").addEventListener("click", runAll);
  $("btnCopy").addEventListener("click", copyResults);

  renderEnv();
  checkConfig();

  // Expose for automated testing / debugging.
  window.BrowserCheck = { results: results, summaryText: summaryText };
})();
