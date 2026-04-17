# FISH_MARKET PWA Feature Inventory

## 🔐 AUTH & SECURITY
✅ Phone + Password Login
✅ Google OAuth Login
✅ JWT HttpOnly Cookies (Access + Refresh)
✅ Refresh Token Lifecycle (7 days)
✅ Account Lockout (5 failed attempts)
✅ Rate Limiting Defense
✅ bcrypt Hashing (12 rounds)
✅ Role-Based Access (Agent/Owner/Viewer/Admin)

## 🚢 AGENT MODULE
✅ Agent Dashboard & Routing
✅ Buyer Management (List, Add, Pay)
✅ WhatsApp Statement / Bill Sharing
✅ Manual Catch Entry (Weight × Rate)
✅ Voice Catch Entry (Tamil/English)
✅ Send Daily Slip to Owner
✅ Agent Boat Weekly Report View
✅ Offline Sync Support (IndexedDB)
✅ Push Notification History / Native Alerts (VAPID)

## 🏪 OWNER MODULE
✅ Owner Master Dashboard
✅ View All Boats & Fleet Metrics
✅ Boat Reports Inbox (Pending/Approved)
✅ Approve / Reject Slips (with rejection reasons)
✅ Owner Weekly Summary View
✅ Staff Salary & Advance Payments Management
✅ Manage System Users (Admin Access)

## 🎙️ VOICE RECOGNITION
✅ Web Speech API (Primary Interface)
✅ Whisper API (Robust Fallback)
✅ Tamil Number Parsing Models
✅ English Number Parsing Models
✅ 35dB Noise Gate Filter
✅ Voice Audio Visualizer Waveforms
✅ Mixed Language Handlers

## 📊 REPORTS & ANALYTICS
✅ Daily Catch Slips
✅ Weekly Agent Boat Report
✅ Weekly Owner Complete Report
✅ Fleet Weekly Summaries (Admin)
✅ Trend Visualizations & Sales Analytics
✅ Export PDF Receipts / Slips

## 🌐 PWA & OFFLINE
✅ Service Worker Asset Caching
✅ IndexedDB Operations Queue
✅ Background Sync Uploader
✅ Offline Badge Indicator
✅ Installable manifest (Mobile Homescreen)

## 🔔 NOTIFICATIONS
✅ REST Get My Notifications
✅ Notification Unread Counters
✅ Mark Single / Mark All as Read
✅ Report Approved/Rejected Alerts
✅ In-App Deep Linking

## 🌍 LANGUAGE & UI
✅ App-Wide Tamil / English Localisation
✅ Deep Ocean Aesthetic Theme
✅ Mobile-First Touch Targets (48px strict)
✅ Glass Morphism Card Overlays
✅ Complex CSS Keyframe Animations
✅ Toast & Notification Visuals
✅ Native Shared UI Library (`Button`, `Input`, `Card`)

## 🗄️ DATABASE
✅ users
✅ boats
✅ catches
✅ boat_reports
✅ boat_report_items
✅ notifications
✅ expenses
✅ beta_feedback

## 🧪 TESTING
✅ React Component Unit Tests (Vitest)
✅ E2E User Workflows (Playwright)
✅ Testing specific Voice Parsing Models
✅ Database Integrity Checks
✅ Accessibility Audits (axe)
✅ Visual Regression Tests
