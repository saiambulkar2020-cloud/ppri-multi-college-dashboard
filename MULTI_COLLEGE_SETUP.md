# Multi-college setup and daily use

The website uses one Supabase project and one Vercel deployment. There is one platform administrator. Each viewer belongs to exactly one college. Only the platform administrator uploads Excel files, restores datasets and edits settings.

## 1. Apply the database update once

1. Back up the existing database and original workbooks using your normal Supabase backup process.
2. For an existing installation, open Supabase **SQL Editor** and run the complete `supabase/migrations/202610150001_college_workspaces.sql` file. For a new installation, first run `202608120001_ppri_dashboard.sql`, then the new migration. Do not rerun the original migration after the new one.
3. If the update reports multiple administrators, open **Table Editor → public.profiles**. Keep the intended platform administrator as `admin`; change all other accounts to `viewer`, then rerun the new migration. The migration is transactional and safe to rerun.
4. All existing workbooks, students and settings are preserved under the college with code `LEGACY`. Open **Table Editor → public.colleges** and rename its code and name to the college those existing records actually belong to, for example `YCCE` and `YCCE`. Keep its generated ID unchanged. If older uploads contain other colleges' data, do not assign viewers until those workbooks have been reimported into their correct colleges.
5. Existing viewers are deliberately left unassigned. Assign them using step 3 below. There is no automatic grant of access based on email, username text or user metadata.

Deploy the updated application after the migration, before reopening the site to viewers. The old application is incompatible with the new schema. Use a maintenance window for this one-time transition. Do not roll back just the Vercel code to the old single-college version while keeping the new schema.

## 2. Set the platform administrator

Create or keep the administrator's real account in **Authentication → Users**. Find the corresponding row in **Table Editor → public.profiles**, matching the Auth user ID:

| Column | Value |
| --- | --- |
| `role` | `admin` |
| `college_id` | NULL / empty |
| `username` | Optional, e.g. `platform.admin` |

Only one profile can have role `admin`; other accounts use `viewer`. The administrator can sign in with their real email or their configured username, using the same Supabase password. `ADMIN_EMAILS` is no longer used; remove it from Vercel settings if present.

Keep these existing Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_SESSION_SECRET`, and your site URL. The service-role key is required for username lookup and protected uploads, and must remain server-only. The short administrator session still lasts 30 minutes.

## 3. Add a college and its viewers

These tables and columns become available only after the new migration has been applied.

1. In **Supabase → Table Editor → public.colleges**, add a row with `code`, `name`, and `is_active = true`. Leave `id` and `created_at` to their defaults. Example: code `RCOEM`, name `RCOEM`. Codes are unique, uppercase, 2–20 characters; use letters, numbers or underscores, starting with a letter.
2. Create a user in **Authentication → Users** with their actual email and password, using your existing account setup process. Ensure the account meets your project's email confirmation requirements. Supabase automatically creates its `profiles` row.
3. In **Table Editor → public.profiles**, find that row by its Auth user ID. In the same save, set `role = viewer`, `college_id` to the college's UUID from step 1, and `username = viewer1.RCOEM`.
4. Sign in to the website as the platform administrator. Choose RCOEM in **College workspace**, open **Admin & settings**, choose its Excel file, review validation, and activate it.
5. The viewer signs in with `viewer1.RCOEM` and their Supabase password. They open RCOEM automatically and see only its dashboard, students and reports.

The college UUID is the `id` column from `colleges`, not its code or name. You may use the foreign-key picker in the Table Editor. A username must end with the exact assigned college code. Usernames are normalized to lowercase and are case-insensitive at login. For example, `Viewer1.RCOEM` and `viewer1.rcoem` are the same username. Prefixes may use letters, numbers, dots, underscores and hyphens, starting with a letter or number. Each username must be unique.

Passwords stay in Supabase Auth. Never put a password in `profiles`, a source file, or an Excel workbook. Email login remains supported and follows the same college assignment.

To add `viewer2.RCOEM`, create another Auth user and assign its profile to the same college. No additional college record or workbook is needed.

## 4. Add another college later

Repeat step 3 using its new code, for example `ABC`, and usernames such as `viewer1.ABC`. **No source file edits, new Supabase project, environment variable changes or Vercel redeployment are required.** Reload the administrator's dashboard to refresh the college selector.

College and account management takes place in Supabase's Table Editor and Authentication screens. Workbook uploads and dashboard settings take place on your website. The website does not add a separate college-administrator role or a user-management screen.

## 5. Uploads, settings and access

- All colleges use the existing PPRI `.xlsx` format, with the `PPRI` worksheet and existing required columns. The upload limit remains 4 MB.
- Select the destination college before choosing a file. Its name and code appear on the upload page and activation confirmation. Ownership comes from that selection, not the filename or spreadsheet title.
- Each upload is a complete replacement for that college's current dataset. It does not append students. Earlier successful versions are retained for rollback. Other colleges' datasets are unchanged.
- The same student UID can exist in different colleges. Duplicate UIDs within one workbook are rejected.
- Settings, report branding and calculations are college-specific. A new college starts with the standard scoring settings and its college name; the administrator can edit them.
- A college with no workbook shows an empty dashboard. Its viewers do not receive another college's data or the demo dataset.
- A viewer without an assignment sees an access message. An inactive college cannot be opened or uploaded to. To suspend a college, set `is_active = false`; set it back to `true` to restore access.
- The administrator can switch colleges. Viewers cannot. College-specific URLs keep different browser tabs independent, and all data APIs verify access again.
- Viewers cannot edit their own role, username or college assignment through the database API. Original workbooks and upload history are administrator-only. Signed-in administrators also perform writes through the protected application routes rather than bypassing the password-session requirement through the public API.
- Renaming a college code automatically updates existing viewer username suffixes. Tell affected users their new usernames. Moving a viewer to another college requires updating both `college_id` and the username suffix in one save.

## 6. Verify the rollout

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` locally. The automated tests execute both migrations against an embedded PostgreSQL runtime and check direct row-level permissions, cross-college access, activation, username suffixes, migration reruns and preserved legacy data.

For a local demo build with no Supabase public environment variables, `node scripts/verify-local.mjs` starts a temporary loopback server and checks login, protected routes, college navigation and PDF downloads. It creates temporary credentials in memory and stops the server afterwards. It does not create a real user or modify college data.

Then verify the deployed Supabase/Vercel configuration with two test colleges: upload distinct workbooks, sign in as each viewer, check their graphs and PDFs, try another college's URL, and confirm replacing/restoring one workbook leaves the other college unchanged. Those hosted-service checks require your Supabase project; local tests do not apply migrations or deploy your site.
