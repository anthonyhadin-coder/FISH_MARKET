## 📋 Pull Request Checklist

### What does this PR do?
<!-- Provide a concise summary of the changes -->

### Type of Change
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that causes existing functionality to not work as expected)
- [ ] 🏗️ Refactor (no functional change, code quality improvement)
- [ ] 📦 Dependency update
- [ ] 🔒 Security fix
- [ ] 📝 Documentation only

### Testing
- [ ] I have added/updated unit tests for my changes
- [ ] I have run `npx turbo run test` and all tests pass
- [ ] I have run `npx turbo run type-check` and there are no type errors
- [ ] I have run `npx turbo run lint` and there are no lint warnings

### Security
- [ ] No secrets or credentials are hardcoded
- [ ] Input validation is applied to all new API endpoints
- [ ] Auth/authorization checks are in place for protected endpoints
- [ ] New dependencies have been audited with `npm audit`

### Database (if applicable)
- [ ] New migration file added with sequential number (e.g. `010_...sql`)
- [ ] Migration is backward compatible (no destructive schema changes)
- [ ] Indexes added for columns used in WHERE / JOIN clauses

### Screenshots / Recordings (for UI changes)
<!-- Add before/after screenshots or a short screen recording -->

### Linked Issues
<!-- Closes #ISSUE_NUMBER -->
