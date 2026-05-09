# Fourk Closeout

Fourk Closeout is a React + TypeScript restaurant operations app that replaces a Google Sheet workflow for lunch and dinner cash closeouts.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- ESLint
- Local mock data only (no Supabase yet)

## Screens

- Dashboard
- New Closeout
- Closeout History
- Admin Settings

`New Closeout` is the primary workflow and includes:

- Header section
- Server payout table
- Petty cash reconciliation section
- Totals section
- Save Draft button
- Submit Closeout button

## Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Closeout Email (Supabase Edge Function + Resend)

Deploy the function:

```bash
supabase functions deploy send-closeout-email --project-ref <your-project-ref>
```

Set function secrets (required):

```bash
supabase secrets set RESEND_API_KEY=<your-resend-api-key> --project-ref <your-project-ref>
supabase secrets set RESEND_FROM_EMAIL="Fourk Closeout <onboarding@resend.dev>" --project-ref <your-project-ref>
```

Notes:

- `RESEND_API_KEY` must only be stored in Supabase function secrets.
- The browser never receives the Resend key.

## Folder Structure

```text
src/
  app/
  components/
    closeout/
    ui/
  data/
  layout/
  pages/
  styles/
  types/
  utils/
```
