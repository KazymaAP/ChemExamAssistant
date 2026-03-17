# Rollback Procedure
1. Find last stable git tag/release.
2. Restore previous `config.js` storage key set if schema changed.
3. Ship hotfix commit and redeploy.
4. If needed, prompt user to import backup from exported JSON/IndexedDB snapshot.
