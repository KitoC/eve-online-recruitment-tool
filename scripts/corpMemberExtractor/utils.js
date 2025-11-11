const { sleep } = require("../utils/general");

// CF detection (very loose): page title “Just a moment…”, or presence of cf-challenge assets.
function looksLikeCloudflare(html) {
  const h = html.toLowerCase();
  return (
    h.includes("<title>just a moment") ||
    h.includes("cf-chl") ||
    h.includes("data-rocketlazyloadscript")
  );
}

// -------- Fetch a page with retry and exponential backoff --------
async function fetchPageHtml(url, retries = 5, baseDelay = 600) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          // A more browser-like UA sometimes helps
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      // Handle 429 (Too Many Requests) with retry
      if (res.status === 429) {
        if (attempt < retries) {
          // Check for Retry-After header first
          const retryAfter = res.headers.get("Retry-After");
          let delay;

          if (retryAfter) {
            // Retry-After can be in seconds (number) or HTTP-date
            const retryAfterNum = parseInt(retryAfter, 10);
            if (!isNaN(retryAfterNum)) {
              delay = retryAfterNum * 1000; // Convert seconds to milliseconds
            } else {
              // If it's a date, calculate the difference
              const retryDate = new Date(retryAfter);
              if (!isNaN(retryDate.getTime())) {
                delay = Math.max(0, retryDate.getTime() - Date.now());
              } else {
                // Fallback to exponential backoff
                delay = baseDelay * Math.pow(2, attempt);
              }
            }
          } else {
            // Exponential backoff: baseDelay * 2^attempt
            delay = baseDelay * Math.pow(2, attempt);
          }

          // Add jitter to avoid thundering herd (only if not using Retry-After)
          const jitter = retryAfter ? 0 : Math.random() * 0.3 * delay; // up to 30% jitter
          const totalDelay = Math.max(delay + jitter, baseDelay);

          await sleep(totalDelay);
          continue;
        } else {
          throw new Error(`HTTP 429 for ${url} after ${retries + 1} attempts`);
        }
      }

      // Handle 404 (Not Found) - don't retry
      if (res.status === 404) {
        throw new Error(`HTTP 404 for ${url}`);
      }

      const html = await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      return html;
    } catch (error) {
      // Don't retry 404 errors - they won't succeed on retry
      if (error.message.includes("404")) {
        throw error;
      }

      // If it's a 429 error and we've exhausted retries, throw it
      if (error.message.includes("429") && attempt >= retries) {
        throw error;
      }

      // For other errors, retry with exponential backoff
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * delay;
        const totalDelay = delay + jitter;

        await sleep(totalDelay);
        continue;
      }

      // If we've exhausted all retries, throw the error
      throw error;
    }
  }
}

module.exports = {
  fetchPageHtml,
  sleep,
  looksLikeCloudflare,
};
