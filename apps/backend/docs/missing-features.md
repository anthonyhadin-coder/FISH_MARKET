# Missing Features & Gap Analysis

## ❌ Features planned but NOT built
- **Real-Time Websockets (Socket.io)**: Push notifications are using DB polling + Service Workers. True realtime connections for owners to see catches appear instantly without refresh is not built.
- **Biometric Security**: TouchID / FaceID for the agent application login for faster auth in the field.
- **Export to Excel / CSV**: Features exist to view trends or print PDFs, but raw ledger data exports aren't built.

## ⚠️ Features built but NOT tested
- **Offline Background Sync Recovery**: The `offlineStorage.ts` layer exists, but unit tests mocking extreme network drops, queue resolution, and ID refactor mapping aren't fully robust.
- **Whisper API Edge Cases**: Local audio parsing is tested well, but the actual cloud service latency simulation needs testing.
- **Analytics Display Mobile Responsiveness**: Chart resizing isn't fully visual-regression tested on extra small mobile screens.

## 🔴 HIGH PRIORITY (Missing)
- [ ] **Analytics Visual Regression Tests**: Verifying chart consistency across device sizes.
- [ ] **Real-time WebSockets**: Dashboard auto-refresh (currently depends on polling).

## 💡 Features that could be ADDED (Future Value)
1. **Weather Integration**: Displaying impending sea conditions or cyclone warnings in the Agent app based on Geo coordinates.
2. **Boat Expenses Photographing**: Agent snaps a photo of the diesel bill to upload immediately next to the daily catch sheet.
3. **Multi-Agent Teams**: Right now agents to boats are 1-1 mappings. Allowing teams.
