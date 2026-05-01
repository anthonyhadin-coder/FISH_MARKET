# Device & Browser Matrix - FISH_MARKET

This document outlines the target hardware and software for harbor agents, ensuring the PWA remains functional in field conditions.

## 📱 Primary Devices (Android)
Harbor agents predominantly use budget to mid-range Android devices.

| Device Category | Min Specification | Recommended Specification |
| :--- | :--- | :--- |
| **OS Version** | Android 8.0 (Oreo) | Android 12.0+ |
| **Browser** | Chrome 90+, Samsung Browser 15+ | Latest Chrome / Edge |
| **Screen Size** | 360px width (Mobile S) | 414px+ (Mobile XL) |
| **Connectivity** | 2G / EDGE (Offline First) | 4G / LTE / Wi-Fi |

## 🍏 Secondary Devices (iOS)
iOS usage is limited but supported with caveats.

| Feature | Support Level | Technical Limitation |
| :--- | :--- | :--- |
| **Web Speech API** | ❌ Unsupported | Native speech recognition not available in Safari |
| **PWA Install** | ⚠️ Partial | Add to Home Screen via 'Share' menu only |
| **Service Worker** | ✅ Supported | iOS 11.4+ |

## 💻 Desktop (Admin/QA)
For office use and analytics.

- **Browsers**: Chrome, Firefox, Edge, Safari (Latest 2 versions).
- **Min Resolution**: 1280x720 (Analytics dashboards).

## 🚨 Device-Specific Edge Cases
- **Low Memory (2GB RAM)**: PWA must not exceed 100MB heap size during voice processing.
- **Sunlight Visibility**: "Deep Ocean" theme must maintain WCAG 2.1 AA contrast ratios (4.5:1 for text).
- **Touch Targets**: Min 44x44px for gloved hands or wet fingers.
