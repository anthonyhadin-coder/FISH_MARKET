# Project Verification Plan

## Tasks:
- [/] Navigate to http://localhost:3000
- [ ] Verify Owner View
    - [ ] Login as Owner
    - [ ] Navigate to 'Reports' tab
    - [ ] Click 'Weekly Report' toggle
    - [ ] Capture state (Boat Weekly Report table & Owner Financial Summary)
- [ ] Verify Agent View
    - [ ] Logout or navigate to Agent view
    - [ ] Navigate to 'Reports' tab
    - [ ] Select 'Agent Weekly Report' toggle
    - [ ] Capture state (Day-by-day work log & Agent Earnings Summary)

## Findings:
- Navigated to home page.
- `click_browser_pixel` timed out twice when trying to click "Login".
- Will attempt direct navigation to `/login`.
