# Test Cases - FISH_MARKET

This document contains detailed test cases for core modules, including functional, negative, and edge-case scenarios.

## 🎙️ Module: Smart Voice Entry (MOD-VOC)
*Focus: Accuracy, Tamil support, and NLP parsing.*

| Test ID | Description | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **VOC-001** | Valid Tamil Input | App is online; Mic permission granted. | 1. Tap Voice Input.<br>2. Say "Sankara 50kg 200rs". | UI shows "Fish: Sankara, Weight: 50, Rate: 200". | P1 | High | Functional |
| **VOC-002** | Mixed Tamil/English Dialect | - | 1. Say "Vaaval fifty kilos and two hundred rupees". | UI correctly parses "Fish: Vaaval, Weight: 50, Rate: 200". | P1 | Medium | Functional |
| **VOC-003** | Ambient Noise Resilience | High background noise environment. | 1. Start voice input near engine noise.<br>2. Say "Nethili 10kg 150". | NLP correctly extracts values despite noise floor. | P2 | Medium | Boundary |
| **VOC-004** | Invalid Weight / Zero | - | 1. Say "Sankara zero kilos 200". | UI displays error: "Weight must be greater than zero". | P2 | High | Negative |
| **VOC-005** | SQL Injection Attempt | - | 1. Say "Sankara select star from users". | Input is parsed as literal text or rejected; no DB error. | P2 | Critical | Security |
| **VOC-006** | Tamil Accent Variation | - | 1. Test with standard vs. local coastal Tamil dialect. | >90% accuracy in fish name recognition. | P3 | Low | Functional |

## 🔄 Module: Offline Sync (MOD-SYN)
*Focus: Data integrity and conflict resolution.*

| Test ID | Description | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SYN-001** | Basic Offline Store | Network: Offline. | 1. Record 5 catches.<br>2. Refresh page. | Data persists in `idb` and is visible in 'Recent Slips'. | P1 | High | Functional |
| **SYN-002** | Automatic Sync on Reconnect | Network: Offline; Data stored. | 1. Change network to Online. | App sends sync request; 5 items appear in Server DB. | P1 | High | Functional |
| **SYN-003** | Dirty Write Conflict | Offline: Edit slip A.<br>Admin: Edit slip A. | 1. Go Online.<br>2. Trigger sync. | System prompts user to "Keep Local" or "Accept Server". | P2 | Medium | Negative |
| **SYN-004** | Session Expiry During Sync | Sync in progress. | 1. Mock 401 Unauthorized during sync chunk. | Sync halts; items remain in local storage; User redirected to Login. | P2 | High | Security |

## 💰 Module: Financials & ₹ Currency (MOD-FIN)
*Focus: Calculation precision.*

| Test ID | Description | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FIN-001** | Large Number Precision | - | 1. Enter 100,000kg at ₹250.55/kg. | Total shows exactly ₹25,055,000.00 (No floating point error). | P1 | Critical | Functional |
| **FIN-002** | Floating Point Edge Case | - | 1. Enter 3.333kg at ₹333.33. | Total shows ₹1,111.10 (Standard rounding applied consistently). | P2 | Medium | Boundary |
| **FIN-003** | Negative Rate Entry | - | 1. Enter rate -50. | UI shows error: "Rate cannot be negative". | P2 | High | Negative |

## 🔁 Module: Rollback & Recovery (MOD-REC)
*Focus: Failure resilience.*

| Test ID | Description | Preconditions | Steps | Expected Result | Priority | Severity | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REC-001** | Migration Rollback | CI/CD triggered. | 1. Run migration `up`.<br>2. Run migration `down`. | DB schema matches original state exactly. | P2 | Medium | Recovery |
| **REC-002** | Feature Flag Kill-switch | Feature flag `v2-nlp` is ON. | 1. Toggle flag to OFF. | App immediately reverts to `v1-nlp` parser without refresh. | P3 | Low | Recovery |
