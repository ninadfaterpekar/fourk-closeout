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
