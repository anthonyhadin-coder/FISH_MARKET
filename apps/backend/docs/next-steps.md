# 🗺️ FISH_MARKET Next Steps (Final Sprint)

## 🔴 WEEK 1: TESTING & STABILITY
- [ ] **Analytics Visual Regression**: Verify charts in Deep Ocean theme across mobile/desktop.
- [ ] **E2E Critical Flow**: Automate 100% of the "Catch -> Report -> Approve" loop.

## 🟡 WEEK 2: OFFLINE & EDGE CASES
- [ ] **IndexedDB Robustness**: Test sync recovery after partial database corruption.
 Agent's phone.
- Action: Finalize VAPID key exchange, connect web push API.

**2. 🟡 Medium Priority: Test Coverage for Analytics & Offline Edge Cases**
Analytics and graphs (`Recharts`) function beautifully, but lack pure e2e coverage protecting against chart axis overlap. The background sync needs an integration test with `vitest`.
- Action: Add Playwright visual regression for charts, and IndexedDB mock tests.
**3. 🟢 Low Priority (Next Major Sprint): Biometrics & Export**
Improve the overall UX drastically by utilizing the WebAuthN API.
- Action: Build Passkey / TouchID login for Agents.
- Action: Build Excel/CSV export button for Owners in `/owner-inbox`.
