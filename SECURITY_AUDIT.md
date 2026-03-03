# Security Audit — Pinfold

**Date:** 2026-03-03
**Scope:** Full codebase review (TypeScript/Svelte frontend, Android native plugins, configuration)

---

## Summary

Pinfold is a privacy-focused Android Pinterest client built with SvelteKit + Capacitor. It scrapes Pinterest directly or via Binternet proxy instances, with optional Tor/I2P routing. The app stores data locally (localStorage) and has no backend server.

**Overall risk level: Low-Medium.** The app has no authentication, no server-side components, and limited attack surface. The main risks relate to SSRF via the user-configurable proxy, path traversal in file downloads, insufficient input validation on data from untrusted external sources, and information leakage via verbose logging.

---

## Findings

### HIGH — SSRF via Unrestricted Proxy URL

**File:** `src/lib/utils/http.ts:88-93`, `src/lib/stores/settings.svelte.ts`

The user-configurable `proxyUrl` is used to construct request URLs with no validation. While the user sets their own proxy, a malicious shared collage link or deep link could potentially influence the proxy setting, and the proxy URL itself is stored in localStorage where other origins in the WebView could access it.

More critically, the proxy rewrites (`proxyBase/?url=<target>`) could be abused if a malicious proxy URL is set — e.g., pointing to internal network addresses.

**Recommendation:** Validate the proxy URL against an allowlist of schemes (http/https only) and reject private IP ranges (127.x, 10.x, 192.168.x, etc.) unless it's explicitly for Tor/I2P local proxies. *(Fixed below.)*

---

### HIGH — Path Traversal in Download Filename

**File:** `src/lib/utils/download.ts:48`

```typescript
const fileName = `pinfold_${pin.id}${suffix}.${ext}`;
```

The `pin.id` comes from Pinterest API responses (or from the proxy HTML parser, where it's derived from URL paths). If a malicious response contains a crafted `id` with path separators (e.g., `../../etc/foo`), the filename passed to the native `saveToDownloads` could write outside the intended directory.

On Android API 29+, MediaStore sanitizes filenames, but on API < 29, the native code does:
```java
File file = new File(downloadsDir, fileName);
```
which is directly vulnerable to path traversal.

**Recommendation:** Sanitize the filename by stripping path separators and special characters. *(Fixed below.)*

---

### MEDIUM — Unvalidated Data from paste.rs Import

**File:** `src/routes/collages/shared/+page.svelte:47-54`

When importing a shared collage via paste.rs, the fetched JSON is parsed and used directly:

```typescript
const rawContent = await fetchPaste(code);
const parsed = JSON.parse(rawContent);
```

While there is a basic type check (`typeof parsed.n !== 'string'`), the `parsed.p` array values are only cast via `map(String)` and then passed to `getPin()`. A malicious paste could contain very large payloads, non-numeric pin IDs, or an extremely large array causing excessive API calls.

**Recommendation:** Validate pin IDs are numeric strings, limit array size, and validate name length. *(Fixed below.)*

---

### MEDIUM — No Proxy URL Scheme Validation

**File:** `src/lib/stores/settings.svelte.ts:130`

The proxy URL stored in settings accepts any string. A user could be social-engineered into entering a `javascript:`, `file:`, or `data:` URL, or a malicious deep link handler could set it.

**Recommendation:** Validate that the proxy URL uses http:// or https:// (or http:// for .i2p/.onion). *(Fixed below.)*

---

### MEDIUM — Verbose Debug Logging in Production (Android)

**File:** `android/app/src/main/java/com/deutsia/pinfold/PrivacyHttpPlugin.java`

The plugin logs full URLs, response headers, body lengths, and even small response bodies:

```java
Log.d(TAG, method + " " + url + " via " + proxyType);
Log.d(TAG, "Blob response headers: " + response.headers());
Log.d(TAG, "Small blob body: " + new String(bytes, "UTF-8"));
```

This can leak sensitive information (URLs containing tokens, CSRF tokens from Binternet, response content) into the Android system log, readable by other apps on rooted devices or via ADB.

**Recommendation:** Guard debug logging behind `BuildConfig.DEBUG` checks. *(Fixed below.)*

---

### MEDIUM — `build/` Directory Committed to Repository

**File:** `.gitignore`

The `build/` output directory is not in `.gitignore` and appears to be committed. Build artifacts can contain source maps or compiled code that shouldn't be in version control. They also bloat the repository.

**Recommendation:** Add `build/` to `.gitignore`. *(Fixed below.)*

---

### LOW — Weak Collage ID Generation

**File:** `src/lib/stores/collages.svelte.ts:33-35`

```typescript
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
```

`Math.random()` is not cryptographically secure. While this is only used for local collage IDs (not security-sensitive), using `crypto.getRandomValues()` would be more robust.

**Recommendation:** Use `crypto.randomUUID()` for ID generation. *(Fixed below.)*

---

### LOW — No Content-Type Validation on Fetched Images

**File:** `src/lib/components/FetchImage.svelte:53-57`

The Content-Type header from fetched images is used directly to construct a data URL:

```typescript
const contentType = response.headers['content-type'] || 'image/jpeg';
return { base64: response.data as string, contentType };
```

A malicious proxy could return `text/html` as the content type, and while browsers won't execute scripts from data URLs in `<img>` tags, validating the content type adds defense-in-depth.

**Recommendation:** Validate that the content type starts with `image/`. *(Fixed below.)*

---

### LOW — android:allowBackup="true"

**File:** `android/app/src/main/AndroidManifest.xml:5`

The app allows full backups, which could expose localStorage data (favorites, collages, settings including proxy URL) via ADB backup on devices with USB debugging enabled.

**Recommendation:** Set `android:allowBackup="false"` since the app stores no irreplaceable data. *(Fixed below.)*

---

### LOW — Missing `httpOnly` / CSP Headers

**File:** `src/app.html`

No Content Security Policy meta tag is set. While this is a Capacitor app (not a traditional web app), a CSP would add defense-in-depth against potential XSS if malicious data from Pinterest is ever rendered unsafely.

**Recommendation:** Consider adding a restrictive CSP meta tag. *(Not auto-fixed — depends on Capacitor compatibility.)*

---

### INFO — npm Dependency Vulnerabilities

`npm audit` reports 5 vulnerabilities (3 low, 2 high):

1. **`cookie` < 0.7.0** (low) — Accepts cookie name/path/domain with out-of-bounds characters. Transitive via `@sveltejs/kit`. Not exploitable here (no SSR/server-side cookie handling in a Capacitor app).
2. **`tar` <= 7.5.7** (high) — Multiple path traversal and symlink poisoning issues. Transitive via `@capacitor/cli`. Only affects the build tool, not the shipped app. Fix requires upgrading to `@capacitor/cli@8.x` (breaking change).

**Recommendation:** These are build-time dependencies only and don't affect the shipped APK. Upgrade to `@capacitor/cli@8.x` and `@sveltejs/kit@3.x` when ready for the breaking changes. Running `npm audit fix --force` would downgrade `@sveltejs/kit` to `0.0.30` which is not viable.

---

### INFO — Positive Security Observations

1. **No innerHTML/dangerouslySetInnerHTML usage** — All user-facing data is rendered via Svelte's `{text}` interpolation, which auto-escapes HTML. No XSS vectors found.
2. **External links use `rel="noopener noreferrer"`** — Correctly prevents tab-napping.
3. **Network security config is scoped** — Cleartext HTTP is only allowed for `.onion` and `.b32.i2p` domains, not globally.
4. **WRITE_EXTERNAL_STORAGE is capped at API 28** — Correct scoped storage handling.
5. **Tor DNS leak prevention** — The `TOR_DNS` placeholder correctly prevents system DNS resolution for `.onion` addresses.
6. **Image domain allowlist** — `image-proxy.ts` validates domains before proxying.
7. **No secrets in source code** — No API keys, tokens, or credentials found.
8. **FileProvider is not exported** — `android:exported="false"` is correctly set.
