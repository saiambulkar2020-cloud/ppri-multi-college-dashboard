# Final Client Deployment Guide — College Placement Dashboard

**Multi-college update, 15 October 2026:** Use [MULTI_COLLEGE_SETUP.md](MULTI_COLLEGE_SETUP.md) for the current database migration, single platform administrator, username assignments and adding colleges. That guide supersedes the single-college database/access instructions below. Student reads now use pagination and dataset activation is scoped and locked per college. The release-audit statements below describe the earlier version, not a new audit of this update.

Prepared for this project on 9 September 2026. This guide is for a nontechnical owner deploying one college's dashboard. It describes the process; it does not mean accounts, billing, or a public deployment have already been created.

## 0. Read this before publishing

The website runs locally and its functional tests passed. However, a fresh production dependency audit reported **8 findings: 1 critical, 4 high, and 3 moderate**. Next.js 16.2.6 is among the affected installed packages. These are dependency advisories, not evidence that your computer has been compromised. They must be reviewed and the affected dependencies updated/tested before an internet-facing client release. The maintainer's [Next.js security advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) confirms an affected range that includes the installed version.

There are also project-specific checks that cannot be replaced by clicking Deploy:

- Make sure large college datasets load completely. The current application reads students without pagination, so a database API response limit can produce incomplete dashboards and PDFs.
- Test the real Supabase upload, activation, restore, settings, login and permissions. The local demo tests do not test the live database. The activation SQL uses a legacy request-role setting that needs developer review against the deployed Supabase/PostgREST version.
- Confirm that the bundled demo names/UIDs are genuinely synthetic. If either public Supabase variable is missing, this application currently falls back to a publicly viewable demo. Before a real rollout, have the developer prevent accidental production demo fallback or ensure the sample data is fully anonymized.
- Agree on account recovery. The website does not yet include Forgot password, Change password, email invitation acceptance, or a user-management page.
- Arrange production-wide login rate limiting; the current in-memory limiter is not shared between hosting instances.

**Recommended order: fix/review these release issues → configure the services → test with sample data → verify the complete college dataset → share with the client.**

You can prepare accounts now. Do not hand over the current folder as an unchanged, security-approved production release. Do not run `npm audit fix --force` blindly.

## 1. Understand the three services

| Service | In plain language | What belongs there |
| --- | --- | --- |
| GitHub | A private online cupboard for the website's source code | Code and change history, not passwords or real Excel files |
| Vercel | The computer on the internet that runs the website | Website deployment and private connection settings |
| Supabase | The database, login system and private file store | College data, user accounts, settings and uploaded workbooks |
| Domain, optional | The address you share | For example, a college-approved placement subdomain |

The connection is:

**Your project folder → private GitHub repository → Vercel website ↔ Supabase**

Your client opens the Vercel/custom-domain website, not GitHub or Supabase. After deployment, your laptop does not need to remain switched on.

`localhost:3001` only refers to the computer opening it. It is not the final client-sharing address.

Use the existing folder containing `package.json`. Do not use the old ZIP in the `release` folder; it predates the latest authentication work.

## 2. Decide who owns and pays for the website

For a proper client handover:

1. Ask the college/client to nominate the permanent owner and billing contact.
2. Put the GitHub repository, Supabase organization, Vercel team and domain under that agreed ownership.
3. Give the developer access through invitations/collaborator permissions rather than sharing the owner's account password.
4. Enable two-factor authentication on the hosting/service owner accounts and save recovery codes privately.
5. Agree who handles future updates, backups, forgotten passwords, and renewals.

Website administrators are different from infrastructure owners. A placement officer who only uploads workbooks or downloads reports does not need a Vercel, GitHub or Supabase-console account.

Get the college's approval for storing its student information with these services, for the selected region, and for the intended staff access.

## 3. Choose a realistic budget

For a professional client website, my recommendation is **Vercel Pro + Supabase Pro**, with a private GitHub repository.

- Vercel currently lists a USD 20/month Pro platform fee including one deploying seat. Extra deploying seats and usage can cost more. Hobby is restricted to personal, noncommercial use, so do not assume a paid client delivery qualifies for it. [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Hobby rules](https://vercel.com/docs/plans/hobby).
- Supabase Pro currently starts at USD 25/month for the base single-project setup. Free projects can pause after a week of inactivity and do not include automatic database backups. [Supabase pricing](https://supabase.com/pricing).

An indicative base budget is **about USD 45/month**, before tax, domain costs, additional team seats, extra projects, email services, and usage overages. Confirm the checkout prices before paying. This is not a fixed quote or an uptime guarantee.

Set spending notifications and decide what should happen if a budget threshold is reached. A setting that pauses a service can also make the client website unavailable.

You can use a college-owned subdomain to avoid buying a new domain. A Supabase custom-domain add-on is not needed just to brand the website's address.

## 4. Prepare the folder and private information

The working project is currently:

`C:\Users\LENOVO\Downloads\ppri-dashboard new\ppri-dashboard`

Its top level should contain `package.json`, `package-lock.json`, `app`, `components`, `lib`, `supabase`, `public`, `data`, `proxy.ts` and the configuration files. Keep the project's structure intact.

Do not publish:

- `.env.local`, `.env.admin-credentials.local`, or any other real environment file.
- Passwords, the database password, server keys or the administrator session secret.
- `node_modules`, `.next`, temporary reports/logs, or old ZIP archives.
- Real college workbooks or student exports in the code repository.

`.env.example` is a placeholder template and can be included. The existing `.gitignore` excludes environment secrets and build output, but only when using Git: dragging an entire folder into a browser upload does not reliably apply that protection.

Review the actual file list before publishing. If a real secret was already committed, removing the file from the latest version is not enough; have the maintainer rotate the secret and address the repository history.

## 5. Put the code in a private GitHub repository

Use [GitHub Desktop](https://desktop.github.com/) on Windows.

If this project already has a published repository, use that repository. Do not create a second copy or replace an existing remote without checking.

For an unpublished folder:

1. Create/sign in to the agreed GitHub account.
2. Install and open GitHub Desktop; sign in there too.
3. Choose **File → Add local repository**.
4. Click **Choose** and select the existing project folder above.
5. If Desktop says it is not a Git repository, use its **create a repository here** link.
6. Check that the resulting repository is the folder already containing `package.json`, not a new nested `ppri-dashboard/ppri-dashboard` folder.
7. Keep the existing project files and `.gitignore`. Do not replace them with a fresh template.
8. Review the Changes list. None of the private files in Section 4 should be selected.
9. If changes need committing, enter a summary such as “Prepared college dashboard release” and click **Commit to main**.
10. Click **Publish repository**, choose the agreed owner/organization, and keep **Keep this code private** checked.
11. Publish and open the repository on GitHub. Verify `package.json` is at the top level.

For this Desktop-first route, do not first create an empty repository with the same name on the GitHub website. [Add a local repository](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop), [publish with Desktop](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop).

**Checkpoint:** one private online code repository, no secrets, no duplicated project folder.

## 6. Create the Supabase project

1. Open the [Supabase dashboard](https://supabase.com/dashboard).
2. Create/select the agreed organization.
3. Click **New project**.
4. Choose a descriptive project name for this college.
5. Generate a strong database password and save it in a password manager.
6. Select a region close to the college and consistent with its data-hosting requirements.
7. Select the agreed plan and review any charges before confirming.
8. Wait until the project is ready.

The database password is not the website login password, API key or session secret. Keep those separate.

Use one isolated Supabase project per college with the current application. Do not place unrelated colleges into this database and assume the accounts will separate their data: that functionality is not implemented.

## 7. Disable public account registration

Do this before real data or staff accounts are introduced.

1. In Supabase, open **Authentication**.
2. Find the configuration for **Sign In / Providers** or the general authentication settings.
3. Turn **Allow new users to sign up** off.
4. Keep anonymous sign-ins off.
5. Keep email/password sign-in enabled.
6. Save the settings.
7. Only create staff accounts deliberately through the owner/admin workflow below.

The application has no public Sign up button, but that is not sufficient protection. Its database rules let authenticated viewers read college records, so unauthorized people must not be able to register themselves. Supabase documents the new-user and anonymous-sign-in controls in [General configuration](https://supabase.com/docs/guides/auth/general-configuration).

You do not need Google login, OTP, OAuth or an external authentication service for the current email/password setup.

## 8. Create the database tables and private workbook storage

Complete the release review in Section 0 before treating the current SQL as final production SQL.

1. In Supabase, open **SQL Editor → New query**.
2. Open the project file `supabase/migrations/202608120001_ppri_dashboard.sql` in a text editor.
3. Copy the entire reviewed file into the SQL Editor.
4. Confirm you have selected the correct new project.
5. Click **Run**.
6. If there is an error, stop and resolve it; do not disable security rules as a workaround.
7. Check **Table Editor** for `profiles`, `dashboard_settings`, `dataset_versions`, `student_records`, `upload_history` and `data_quality_results`.
8. Check **Storage** for the `ppri-workbooks` bucket and confirm that it is **private**.
9. Have the developer check Supabase's Security Advisor and verify anonymous/viewer/admin database permissions.

This migration creates the application's schema, access rules, initial settings, private bucket and new-user profile trigger. Run it before creating staff users; it does not automatically backfill profile rows for accounts created beforehand.

**Checkpoint:** required tables and private bucket exist, and access policies have been reviewed.

## 9. Create the real website administrator

The local `admin` account does not become a live Supabase account automatically.

1. Open Supabase **Authentication → Users**.
2. Choose **Add user → Create new user** (wording may vary slightly).
3. Enter the designated administrator's real email address and a unique strong password.
4. For this owner-created internal account, confirm its email using the available **Auto Confirm User** option.
5. Create the user.
6. Open **SQL Editor → New query**.
7. Paste the following, replacing only the example email with the exact account email:

```sql
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = lower('placement.admin@your-college.edu')
returning id, email, role;
```

8. Click **Run**.
9. Verify exactly one returned row shows the intended email and `admin`.
10. If zero rows appear, stop: check the email spelling, that the migration ran before account creation, and that a profile was created.

Do not manually insert a password into a database table. Supabase Authentication manages passwords.

Use `profiles.role` as the production authority. Leave the optional `ADMIN_EMAILS` environment variable unset or empty for this guide. An email left in that allowlist could retain application-level admin access even after its profile is demoted.

**Checkpoint:** the intended administrator exists and has an admin profile.

## 10. Obtain the connection values

In Supabase, the **Connect** dialog provides the Project URL and publishable key. **Settings → API Keys** provides the available keys. Prefer current publishable/secret keys for a new project. A publishable key is designed for public application code; a secret key is highly privileged and must stay server-side. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

You need:

| Value | Where it comes from | Destination in this project's Vercel settings |
| --- | --- | --- |
| Project URL | Supabase Connect dialog | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key | Supabase Connect/API Keys | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key | Supabase Settings → API Keys | `SUPABASE_SERVICE_ROLE_KEY` |
| A separate random session secret | Your password manager or developer | `ACCESS_SESSION_SECRET` |
| Final website address | Vercel production domain/custom domain | `NEXT_PUBLIC_SITE_URL` |

The environment name `SUPABASE_SERVICE_ROLE_KEY` is the name this code expects; it can hold the current Supabase secret key. Do not rename it to a different tutorial's variable name.

Generate a fresh random production `ACCESS_SESSION_SECRET` of at least 32 characters—64 random characters is a straightforward choice. It is not an admin password or Supabase key. Your local setup already has a development secret; keep production separate. Do not run `auth:setup --rotate` merely to view or copy settings, as that intentionally replaces the local credentials and secret.

Store secrets privately. Never send them in a public screenshot, support ticket, client instruction document or code repository.

## 11. Import the project into Vercel

1. Open the [Vercel dashboard](https://vercel.com/dashboard) and select the agreed team.
2. Choose **Add New → Project**.
3. Connect GitHub if needed; grant access to the required private repository rather than unrelated repositories.
4. Find the repository from Section 5 and click **Import**.
5. Set/check the project name.
6. Confirm **Framework Preset: Next.js**.
7. Set **Root Directory** to the directory containing `package.json`—normally `./`.
8. Leave the Next.js output directory setting at its default.
9. The project already supplies `npm install` and `npm run build` in `vercel.json`; no custom startup command is needed on Vercel.
10. Use Node.js **24.x**, matching the major version used for local verification. Vercel exposes this under **Settings → Build and Deployment → Node.js Version**; verify it in the build configuration/logs. [Supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Do not select a static-site preset, GitHub Pages, or drag only a generated HTML folder online. This dashboard needs a running server for login, protected PDF generation and uploads. Vercel supports the Next.js server features used here. [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

## 12. Add the Vercel environment variables

Think of environment variables as the website's private connection settings. Add each row separately; do not paste the whole `.env.local` file.

Before the first deployment, expand **Environment Variables**, or open **Project → Settings → Environment Variables**.

Add these to **Production**:

| Exact name | What to paste |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL beginning with https |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Complete publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Complete server secret key |
| `ACCESS_SESSION_SECRET` | Fresh random production session secret |
| `NEXT_PUBLIC_SITE_URL` | Final HTTPS website origin, without /dashboard or a trailing slash |

If Vercel has not assigned the final address yet, leave `NEXT_PUBLIC_SITE_URL` until the first deployment gives you the exact production domain, then add it and redeploy. The current application does not read this setting, so its absence does not block the first password-login deployment; maintain it correctly for future integrations.

Do not add `ACCESS_ADMIN_ID` or `ACCESS_ADMIN_PASSWORD_HASH` for this Supabase-backed deployment. Those are local/demo credentials and are ignored in Supabase mode. Omit `ADMIN_EMAILS` because Section 9 assigns the database role directly.

For each value:

1. Copy the value without extra spaces or quotation marks.
2. Choose **Production** scope.
3. Mark server secrets as sensitive if that option is offered.
4. Save.
5. Recheck the variable names carefully.

Do not use production database credentials for automatic Preview or Development deployments. Use a separate test Supabase project and separate secrets if a developer sets up those environments. Preview deployments without Supabase settings currently enter demo mode, so keep them protected and ensure sample data is synthetic.

Environment changes apply to subsequent deployments; redeploy after changing them. [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 13. Deploy privately for verification

Only proceed with the reviewed/fixed release from Section 0.

1. Click **Deploy**.
2. Wait for installation and the production build.
3. If it fails, open the build log and give the first actual error to the developer. Do not share secret values.
4. When the deployment is Ready, find the stable **Production domain** in the project's Domains section.
5. Use that address for future setup, not a one-off preview/deployment URL.
6. Add/update `NEXT_PUBLIC_SITE_URL` with that origin and redeploy if required.
7. Keep the rollout restricted to the owner/testers while validation is incomplete.

Review **Settings → Deployment Protection**. During testing you may protect all deployments and invite the testers. At final launch, use an agreed configuration such as **Standard Protection**, which protects nonproduction/deployment URLs while allowing the production domain to reach the application's own login. Do not disable all protection just to resolve a client-access problem. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection).

A Vercel sign-in screen and the dashboard's college login are different. Ordinary college staff should ultimately use the college login, without needing Vercel accounts.

## 14. Set Supabase authentication URLs

After you know the exact website domain:

1. Open Supabase **Authentication → URL Configuration**.
2. Set **Site URL** to the final website origin, for example your actual Vercel production domain.
3. Add the exact permitted redirect URL for the application's existing callback: the same origin followed by `/auth/callback`.
4. Save.
5. When you attach the college domain later, update Site URL and the corresponding exact callback URL again.

Do not put `localhost` in the production Site URL. Avoid allowing arbitrary domains or a broad wildcard across all Vercel deployments. [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

These settings prepare approved authentication redirects. They do not create a Forgot password screen or make an unimplemented invitation/recovery flow work.

## 15. Verify login and load the college workbook

Start with a safe test workbook. Use real data only after the security and permission checks pass.

1. Open a private/incognito browser window.
2. Visit the website.
3. Confirm that signed-out access shows a login page—not student data or Demo Mode.
4. Sign in with the **Supabase administrator email and password**, not the local `admin` ID.
5. An empty live dashboard is normal before the first successful upload. The local 40-student demo does not automatically migrate to Supabase.
6. Open **Admin & settings**.
7. Click **Choose Excel File**.
8. Select the agreed workbook:
   - `.xlsx` format;
   - at most 4 MiB;
   - worksheet named `PPRI`;
   - required columns/valid UIDs and scores.
9. Review the validation preview, including missing values, duplicate UIDs and rejected records.
10. Correct critical errors in Excel and re-upload if necessary.
11. Click **Confirm & activate dataset**, then confirm the change.
12. Check the full student count and every branch count against the workbook.
13. Download a college PDF and a branch PDF and verify their counts and labels too.

**Important:** each successful upload becomes the entire active dataset. It is not an append/merge. If the website should show the whole college, upload the complete college workbook; uploading only IT would make only that uploaded dataset active.

If upload or restore reports “Admin access required” despite a valid administrator, have the developer check the activation SQL compatibility issue from Section 0. Do not make the workbook bucket public or turn off RLS.

## 16. Save the institution settings

In **Admin & settings**:

1. Enter the approved institute name and dashboard title.
2. Set the footer and approved branding.
3. If using a logo, supply the supported logo URL. This screen is not a logo-file uploader.
4. Confirm the PIRI weights/thresholds with the placement team; do not change scoring rules solely to improve the displayed outcome.
5. Click **Save settings**.
6. Refresh the page.
7. Sign out and sign in again to confirm persistence.
8. Generate a new PDF and check the institute name, date and figures.

Saving settings requires the live Supabase setup. In demo mode the save/upload controls remain disabled.

## 17. Create viewers and additional administrators

Create a separate account for each authorized person.

For a viewer:

1. Supabase **Authentication → Users → Add user → Create new user**.
2. Enter the person's email and a strong unique password.
3. Confirm the owner-provisioned internal account.
4. Leave the generated `profiles.role` as `viewer`.
5. Test the account in a separate browser session.

For another administrator, create the account the same way and run the exact role-update query from Section 9 for that email.

The current website's access is:

| Person/account | View college/student data | Use official PDF controls | Upload, restore and settings |
| --- | --- | --- | --- |
| Signed-out visitor in live mode | No | No | No |
| Viewer | Yes, across all branches | Yes, college and any branch | No |
| Administrator with a valid protected session | Yes | Yes, college and any branch | Yes |

Administrator protected access lasts **30 minutes**. Another password verification is required after it expires. Signing out clears access in that browser.

Limitations to explain to the client:

- An IT viewer is not automatically restricted to IT. Branch-specific account access is not implemented.
- A branch PDF contains that selected branch, but this does not restrict what the viewer or administrator can see elsewhere.
- Viewer CSV export currently remains available.
- No website control can prevent screenshots or the browser's own Print/Save as PDF for data already visible to a user.
- The website has no self-service account creation, password-change or password-recovery page.

If the client needs branch-only users, multiple-college isolation, or self-service password recovery, those are additional implementation requirements before that handover promise can be made.

## 18. Decide how forgotten passwords will be handled

For the current small, owner-managed staff setup, name a responsible technical administrator who can reset a user's password securely through Supabase's supported administration tools. Do not send database/API keys to staff or manually alter password hashes. The supported server-only API is [Supabase updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid); a nontechnical owner should ask the maintainer to perform this safely.

If the client requires a “Forgot password” email flow before launch:

1. Have the developer add and test request-reset and new-password pages.
2. Choose a production email provider and verify a college-approved sending domain.
3. Have the domain owner add the provider's required DNS records.
4. Configure Supabase **Authentication → Custom SMTP** with the provider's settings.
5. Configure the exact recovery URLs and templates for the implemented flow.
6. Test recovery with a normal staff email account, not just an infrastructure-owner address.
7. Test invalid/expired links, successful password change and subsequent login.

Supabase's built-in email sender is restricted and is not intended as a production email service. SMTP configuration alone does not implement the missing application screens. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

Do not promise that a “temporary password” must be changed on first login: this application does not enforce that workflow.

## 19. Add a professional college domain

First verify the website on its Vercel production domain. Then:

1. Agree the address with the college, preferably a subdomain it owns, such as `placements.your-college.edu` (illustrative only).
2. In Vercel, open **Project → Settings → Domains** and add that address.
3. Vercel will show the DNS record(s) required for this exact project.
4. Send those records to the college's authorized domain/DNS administrator.
5. Have them add the specified record(s), then wait until Vercel reports valid configuration and HTTPS is ready.
6. Do not change unrelated records, nameservers or email/MX settings. Adding the placement subdomain should not disrupt the college's main site/email.
7. Update Vercel `NEXT_PUBLIC_SITE_URL` and Supabase Site URL/callback allowlist to the final domain.
8. Redeploy after the Vercel environment change and retest login, settings and PDF downloads on the final domain.
9. Use one consistent final domain when signing in and downloading; login cookies do not automatically transfer between domains.

Use the values shown by Vercel, not an IP/CNAME copied from an old tutorial. [Vercel custom-domain instructions](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

A custom website domain does not require buying a custom Supabase API domain.

## 20. Run the final acceptance checklist

Do not share broadly until the following are verified on the real HTTPS deployment:

### Release and data checks

- [ ] Dependency findings have been updated/reviewed and there is no unaddressed exploitable critical/high release issue.
- [ ] Live Supabase migration, import, activation, restore and settings have actually been tested.
- [ ] Public sign-ups and anonymous sign-ins are disabled.
- [ ] All student and branch totals match the complete active workbook, including the largest expected cohort.
- [ ] The website is not showing Demo Mode or identifiable sample data when signed out.
- [ ] Production secrets are excluded from the repository and previews.
- [ ] RLS is enabled and `ppri-workbooks` is private.

### Sign-in and permissions

- [ ] A new private browser cannot see dashboard/student data without login.
- [ ] Wrong credentials are rejected.
- [ ] A viewer can view data and download overall-college or individual-branch PDF reports, but cannot open Admin & settings.
- [ ] An administrator can save settings and download the college PDF.
- [ ] Every branch PDF includes only its own branch's report data.
- [ ] Signing out blocks subsequent protected actions.
- [ ] An expired protected session asks for the password again.
- [ ] Direct PDF API requests are denied without signed-in dashboard access; developer verifies this.
- [ ] Recovery/support arrangements are documented.

### Client usability and operations

- [ ] Final domain uses HTTPS and does not unexpectedly demand a Vercel account.
- [ ] Laptop and phone layouts are usable.
- [ ] A different device/network can open the live site while the development laptop is off.
- [ ] PDF labels, package estimates, date, branding and page layout are checked.
- [ ] Production-wide rate limits, logs, billing alerts and support ownership are agreed.
- [ ] Database and uploaded-workbook backups are arranged and a restore test is documented.

A build succeeding is only one item in release verification, not proof that every production integration or security boundary works.

## 21. Hand over the website to the client

For normal staff, hand over:

1. The final HTTPS website link.
2. Their own email login ID.
3. Their account password via a secure private channel/password-manager share, not in a group message.
4. Their role: Viewer or Administrator.
5. Brief instructions for viewing, uploading the complete workbook and downloading PDFs.
6. The forgotten-password/support contact.
7. A note explaining the 30-minute protected admin session and the current branch/CSV access limitations.

For the nominated infrastructure owner, additionally hand over:

- Ownership/invitations for GitHub, Vercel, Supabase and the domain.
- Billing and renewal responsibility.
- The final approved source version.
- Backup/restore and ongoing maintenance arrangements.
- A secure way to access the required secrets, without including them in the ordinary client guide.

Suggested client message:

> Your College Placement Dashboard is ready at: [FINAL WEBSITE LINK].
>
> Your login ID is: [YOUR COLLEGE EMAIL]. Your password will be shared privately.
>
> Your access level is: [ADMINISTRATOR / VIEWER].
>
> Administrators can manage the college workbook/settings. Signed-in dashboard users can download the overall-college or individual-branch PDF reports. Protected administrator access lasts 30 minutes.
>
> For access issues or password help, contact: [SUPPORT CONTACT].

Do not send the client a localhost link, Supabase secret key, database password, `.env` file or an unreviewed old release ZIP.

## 22. Maintain it after handover

There are three different kinds of updates:

| Change | Where to do it | Redeployment? |
| --- | --- | --- |
| New college workbook | Website → Admin & settings | No |
| Institute settings/scoring configuration | Website → Admin & settings | No |
| New staff account/role | Supabase administration | Usually no; retest the user's access |
| Website code/security update | Reviewed change → GitHub → Vercel | Yes |
| Vercel connection secret/variable | Vercel project settings | Yes |

Have the developer test changes before pushing the production branch. Do not connect unreviewed preview builds to the live college database.

Backups and recovery are separate:

- **Dataset Restore** changes which stored workbook version is active. It does not restore settings or website code; current scoring settings still apply.
- **Vercel rollback** restores a previous code deployment. It does not roll back Supabase data. [Vercel rollback](https://vercel.com/docs/instant-rollback).
- **Database backup** covers database contents, not the uploaded Storage objects themselves. Keep encrypted copies of original workbooks and arrange Storage backups separately. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

Set an agreed retention policy for old student datasets and workbooks. The current app has no automated retention cleanup interface, and its history view shows only the latest 20 versions.

Review staff access when people leave. Demote/remove access with the maintainer's help and revoke sessions as appropriate. If `ADMIN_EMAILS` was used despite this guide, remove the email there too and redeploy.

Review security updates, failed-login patterns, usage and billing regularly. The built-in login limiter is per server process; have the developer add/test production-wide rules without blocking legitimate college traffic. Vercel offers [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

## 23. Troubleshooting without weakening security

| Symptom | First thing to check |
| --- | --- |
| Local admin ID fails online | Use the Supabase account email/password, not the demo ID |
| Demo Mode appears online | Both public Supabase variables must exist and be correct in Production; redeploy; do not share real data yet |
| “Administrator access is not configured” | Check `ACCESS_SESSION_SECRET`, its length and environment scope; redeploy |
| Viewer cannot download PDFs | Check that the viewer is signed in and using the same website domain; PDF download requires dashboard access but not administrator access |
| Admin page keeps asking for login | Check password/session expiry, exact account profile role, same domain, HTTPS and cookies |
| Upload/settings controls are disabled | Confirm live Supabase mode and an administrator account |
| Upload says server credentials missing | Check `SUPABASE_SERVICE_ROLE_KEY` and redeploy |
| Import/restore says Admin access required | Developer checks the activation SQL's legacy role setting; do not disable RLS |
| Fewer students appear than in Excel | Check validation rejects, active dataset and API pagination; do not approve incomplete PDFs |
| Dashboard is empty | Before first upload this is expected; otherwise check database query errors and active dataset |
| Settings do not persist | Confirm successful save, live database connection and admin role |
| Client sees Vercel's login | Check stable production domain and the agreed Deployment Protection scope |
| PDF request gets “must come from this website” | Use the same HTTPS website domain; maintainer checks reverse-proxy origin configuration |
| Domain fails to open | Check Vercel's exact DNS requirements and HTTPS status with the DNS owner |
| Password-reset email does not work | Current app has no finished recovery UI; production SMTP and recovery screens are additional setup |
| Build fails | Review first build error, root folder, Node version, dependency fixes and missing files |
| Website stops after inactivity | Check service health, Supabase plan/pausing, billing and usage limits |

## Developer release notes

These notes are for the maintainer, not instructions for a nontechnical owner to edit production blindly.

- Audit run: `npm audit --omit=dev --json` returned 8 affected production dependency entries on the reviewed lockfile. The audit suggested Next.js 16.3.4; choose a currently patched compatible release and rerun the audit and application tests. Review remaining transitive findings rather than blindly forcing package downgrades.
- `lib/data.ts` and `lib/upload.ts` need complete pagination/error handling for student/UID fetches. Verify API row caps; Supabase documents a default 1,000-row maximum and pagination. [Supabase row-limit guidance](https://supabase.com/docs/reference/python/select).
- `public.activate_dataset` reads `request.jwt.claim.role`; current PostgREST documents JSON claims in `request.jwt.claims`. Review/adjust the function and test actual service-role import/restore. This is a compatibility concern, not a reproduced failure against this user's unconfigured live project. [PostgREST request claims](https://docs.postgrest.org/en/v14/references/transactions.html).
- Keep profile roles and database RLS authoritative; do not use `ADMIN_EMAILS` as a substitute for promoting `profiles.role`.
- Fail closed for missing production database config or sanitize the bundled sample data before any previews are public.
- Test the published-origin cookie/CSRF behavior on Vercel, not only localhost.
- Test denied requests through the public Supabase API too, especially with sign-ups disabled and viewer credentials.
- Confirm the college accepts all-branch viewer visibility and CSV export, or implement the narrower authorization model first.
- Implement recovery/change-password flows if required; do not confuse the auth callback with a complete recovery screen.
- Keep a record of the final source version, migration, test evidence, acceptance and service ownership.

**Your next practical step:** have the release issues at the top corrected and verified. Then follow Sections 2–21 in order; the final deliverable is an HTTPS website, working college accounts, verified real data, and a documented owner/support plan.
