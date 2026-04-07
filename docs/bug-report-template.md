# Bug Report Template

## 📋 General Information
- **Bug ID**: [MOD-XXX]
- **Title**: [Concise description of the issue]
- **Severity**: Critical / High / Medium / Low
- **Priority**: P1 / P2 / P3
- **Reported By**: [Name]
- **Date**: [YYYY-MM-DD]

## 🎭 Environment
- **Browser**: [e.g., Chrome 118]
- **OS**: [e.g., Android 13]
- **Device**: [e.g., Samsung Galaxy A54]
- **Version**: [e.g., v1.2.4-beta]

## 👣 Steps to Reproduce
1. Go to [Page/Component]
2. Action A (e.g., Tap 'Record Catch')
3. Action B (e.g., Speak Tamil input "Sankara 50kg 200rs")
4. Observe the result.

## 📉 Results
- **Expected Result**: [What should have happened? (Measurable)]
- **Actual Result**: [What actually happened? (Include error codes if any)]

## 📎 Attachments
- [ ] Screenshot attached
- [ ] Screen recording attached
- [ ] Console logs attached
- [ ] Network logs (HAR file) attached

## 🛠️ Developer Notes
- **Component**: `client/src/components/voice/VoiceInput.tsx`
- **Possible Cause**: NLP parsing regex failing on specific Tamil dialect.
