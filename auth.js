(function () {
  function log(...args) {
    const ts = new Date().toISOString();
    console.log(`[AUTH ${ts}]`, ...args);
  }

  function getGoogleTokenSilently() {
    log("Silent token: attempting");
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          log("Silent token: failed", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        if (!token) {
          log("Silent token: returned null/empty");
          resolve(null);
          return;
        }
        log("Silent token: success", token ? "[redacted]" : "(empty)");
        resolve(token);
      });
    });
  }

  function authenticateWithGoogleInteractive() {
    log("Interactive auth: starting");
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError) {
          log("Interactive auth: FAILED", chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!token) {
          log("Interactive auth: no token returned");
          reject(new Error("No token returned from interactive auth"));
          return;
        }

        await chrome.storage.sync.set({ onboarded: true });
        log("Interactive auth: success", token ? "[redacted]" : "(empty)");
        resolve(token);
      });
    });
  }

  async function ensureAuthedAndGetToken() {
    // We consider ourselves "onboarded" if we've completed at least one interactive auth before.
    const { onboarded } = await chrome.storage.sync.get(["onboarded"]);
    log("ensureAuthedAndGetToken called. onboarded?", onboarded);

    // Case 1: Already onboarded → try silent first
    if (onboarded) {
      const silentToken = await getGoogleTokenSilently();
      if (silentToken) {
        log("ensureAuthedAndGetToken: using silent token");
        return silentToken;
      }

      log("ensureAuthedAndGetToken: silent failed, trying interactive fallback...");
      const freshToken = await authenticateWithGoogleInteractive();
      if (!freshToken) {
        log("ensureAuthedAndGetToken: interactive fallback STILL gave no token");
        throw new Error("Auth failed: no token from interactive fallback");
      }
      return freshToken;
    }

    // Case 2: First time ever → go interactive immediately
    log("ensureAuthedAndGetToken: first-time interactive required...");
    const newToken = await authenticateWithGoogleInteractive();
    if (!newToken) {
      log("ensureAuthedAndGetToken: FIRST interactive returned no token");
      throw new Error("Auth failed: could not obtain token on first login");
    }
    return newToken;
  }

  self.Auth = {
    ensureAuthedAndGetToken,
    getGoogleTokenSilently,
    authenticateWithGoogleInteractive,
  };
})();