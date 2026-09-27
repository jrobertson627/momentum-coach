# Momentum Coach

A calm, cross-device coach that helps enthusiastic starters become finishers.

Most productivity tools help you organize more work. Momentum Coach watches for the habits that stop you finishing — losing interest, perfectionism, starting something new — and recommends one small, concrete next action, with an explanation of why.

## Stack

- React + TypeScript + Vite, installable as a PWA
- Supabase (Postgres, auth, sync)
- Hosted on Render — _coming in M0_

## Development

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key.

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck and build to dist/
npm run preview    # serve the production build (PWA + service worker)
npm run lint       # oxlint
npm run format     # prettier
```

### Database changes

Schema changes live in `supabase/migrations/`. The Supabase GitHub integration applies them to the hosted project when they merge to `main`.

```bash
npx supabase migration new <name>   # create a migration file
```

App icons are generated from `public/logo.svg` with `npm run icons`.

## Roadmap

See the [milestones](https://github.com/jrobertson627/momentum-coach/milestones) and the [project board](https://github.com/users/jrobertson627/projects/1).
