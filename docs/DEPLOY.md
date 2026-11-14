# Deploying to Netlify (free plan)

1. **Push the repo to GitHub** (Netlify builds from it).
2. **Netlify → Add new site → Import an existing project → GitHub →** choose this repository.
3. Build settings are read from `netlify.toml` (build command `npm run build`, publish dir `apps/web/.next`, Node 22).
4. **Site configuration → Environment variables →** add:
   - `NEXT_PUBLIC_SUPABASE_URL` – the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – the anon / publishable key
   - `NEXT_PUBLIC_PLATFORM_DRIVER` – `supabase`
   These are public values (they end up in the browser bundle). Never add the `service_role` key.
5. **Deploy.** Note the site URL (`https://<name>.netlify.app`).
6. **Supabase → Authentication → URL Configuration:** set *Site URL* to the Netlify URL and add
   `https://<name>.netlify.app/**` to *Redirect URLs* (email-confirmation links return there).
7. Open the site, sign up / sign in, run a tool.

Supabase free projects pause after about a week without activity; open the app (or the Supabase dashboard) at least
once a week, or add a scheduled keep-alive later.
