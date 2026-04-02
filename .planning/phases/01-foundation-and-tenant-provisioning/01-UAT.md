---
status: testing
phase: 01-foundation-and-tenant-provisioning
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md]
started: 2026-03-25T17:00:00Z
updated: 2026-03-25T17:00:00Z
---

## Current Test

number: 1
name: App builds and dev server starts
expected: |
  Run `pnpm turbo build` — all packages build with zero errors.
  Run `pnpm run dev` — Next.js dev server starts on localhost:3000.
awaiting: user response

## Tests

### 1. App builds and dev server starts
expected: Run `pnpm turbo build` — all packages build with zero errors. Run `pnpm run dev` — Next.js dev server starts on localhost:3000.
result: [pending]

### 2. Sign-in page renders
expected: Navigate to http://localhost:3000/sign-in. See a centered card with "Sign in to Fleet Factory" title, email input, password input, "Sign in" button, and a link to sign-up page.
result: [pending]

### 3. Sign-up page renders
expected: Navigate to http://localhost:3000/sign-up. See a centered card with "Create your account" title, email input, password input, submit button, and a link to sign-in page.
result: [pending]

### 4. Route protection redirects unauthenticated users
expected: Without being signed in, navigate to http://localhost:3000/businesses. You should be redirected to /sign-in automatically.
result: [pending]

### 5. Sign in with email and password
expected: On the sign-in page, enter valid Supabase credentials and submit. You should be redirected to /businesses. Session persists across browser refresh (refreshing /businesses stays on /businesses, not redirected to sign-in).
result: [pending]

### 6. Businesses list with empty state
expected: After signing in (with a fresh account that has no businesses), /businesses shows an empty state with a message like "Create your first business" and a link/button to /businesses/new.
result: [pending]

### 7. Create business wizard renders with 3 steps
expected: Navigate to /businesses/new. See a multi-step wizard. Step 1 shows Business Details: name input, slug input, and industry select dropdown. Step navigation buttons (Next/Back) move between steps.
result: [pending]

### 8. Wizard auto-generates slug from name
expected: In step 1 of the wizard, type "My Test Business" in the name field. The slug field should auto-populate with "my-test-business". Manually editing the slug should stop auto-generation.
result: [pending]

### 9. Wizard step 2 shows default departments
expected: Click Next to step 2 (Departments). See the 4 default departments listed: Owner, Sales, Support, Operations — each with a description. These are read-only previews of what will be created.
result: [pending]

### 10. Wizard step 3 shows review summary
expected: Click Next to step 3 (Review & Deploy). See a summary showing the business name, slug, industry, 4 departments to be created, starter agents to be provisioned, and that a deployment job will be queued.
result: [pending]

### 11. Submit wizard creates business
expected: Click "Create Business" on the review step. After a brief loading state ("Creating..."), you should be redirected to the new business overview page at /businesses/[id].
result: [pending]

### 12. Business overview dashboard displays correctly
expected: The business overview page shows: business name with status badge, 4 stats cards (Deployment Status, Active Agents count, Departments count, Pending Approvals), Quick Links section, and a Recent Activity placeholder.
result: [pending]

### 13. Sidebar navigation shows business sub-nav
expected: While on a business page, the left sidebar shows: "Fleet Factory" brand at top, "Businesses" main link, and sub-navigation links for Overview, Departments (active), Deployments/Approvals/Tasks/Logs (grayed out as future placeholders). User dropdown at bottom with sign-out option.
result: [pending]

### 14. Departments page shows 4 seeded departments
expected: Click "Departments" in the sidebar (or navigate to /businesses/[id]/departments). See 4 department cards in a grid: Owner, Sales, Support, Operations — each with an icon, name, type label, and description.
result: [pending]

### 15. Businesses list shows created business
expected: Navigate back to /businesses. The table now shows your created business with columns: Name (as a link), Industry, Status badge, Role (owner), and Created date.
result: [pending]

### 16. Sign out clears session
expected: Click your user dropdown in the sidebar bottom and click "Sign out". You should be redirected to /sign-in. Navigating to /businesses should redirect back to /sign-in (session is cleared).
result: [pending]

## Summary

total: 16
passed: 0
issues: 0
pending: 16
skipped: 0

## Gaps

[none yet]
