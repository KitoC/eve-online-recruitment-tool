// CF detection (very loose): page title “Just a moment…”, or presence of cf-challenge assets.
function looksLikeCloudflare(html) {
  const h = html.toLowerCase();
  return (
    h.includes("<title>just a moment") ||
    h.includes("cf-chl") ||
    h.includes("data-rocketlazyloadscript")
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -------- Fetch a page --------
async function fetchPageHtml(url) {
  const res = await fetch(url, {
    headers: {
      // A more browser-like UA sometimes helps
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return html;
}

module.exports = {
  fetchPageHtml,
  sleep,
  looksLikeCloudflare,
};
