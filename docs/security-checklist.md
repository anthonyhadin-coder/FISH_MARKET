# Security Testing Checklist (OWASP Top 10) - FISH_MARKET

This checklist ensures the application meets production-grade security standards.

## 🔑 Authentication & Authorization (Broken Access Control)
- [ ] **JWT Validation**: Verify that the backend rejects requests with expired or malformed JWTs.
- [ ] **Role Polling**: Ensure an 'Agent' cannot access Admin-only analytics endpoints.
- [ ] **IDOR Check**: Verify that an agent cannot view or edit a catch record belonging to another agent by changing the ID in the URL/API call.
- [ ] **Session Expiry**: Verify that the application redirects to login immediately upon token expiration during an active operation.

## 💉 Injection Attacks (SQL & NoSQL)
- [ ] **Parameterized Queries**: Verify all DB interactions use the `pool.execute` pattern discovered in `db.ts`.
- [ ] **Input Sanitization**: Test voice entry fields for common SQL injection strings (e.g., `' OR 1=1 --`).
- [ ] **Zod Schema Validation**: Ensure all API payloads are strictly validated against shared Zod schemas.

## 🛡️ Cross-Site Scripting (XSS)
- [ ] **Content Security Policy (CSP)**: Verify `helmet` is correctly configured in `server/src/index.ts`.
- [ ] **Escaping**: Verify that fish names or boat registrations containing `<script>` tags are rendered as plain text, not executed.

## 🏗️ Insecure Design & Logic
- [ ] **Offline Data Integrity**: Verify that local modifications to `idb` cannot bypass server-side validation during sync.
- [ ] **Rate Limiting**: Verify that brute force attempts on the `/api/auth/login` endpoint are blocked after 5 failed attempts.

## 📦 Sensitive Data Exposure
- [ ] **LocalStorage Check**: Verify no PII (Phone numbers, Aadhaar, etc.) or passwords are stored in `localStorage`.
- [ ] **HTTPS Only**: Verify that cookie flags (Secure, HttpOnly) are set for all production environments.
- [ ] **Error Logs**: Verify that Sentry does not capture sensitive payload data (e.g., passwords).

## 🐋 Security Automation
- [ ] **Audit**: Run `npm audit` on every build to check for vulnerable dependencies.
- [ ] **SAST**: Integrated GitHub CodeQL scanning.
- [ ] **DAST**: Weekly OWASP ZAP scans against the staging environment.
