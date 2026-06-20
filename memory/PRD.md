# FileMorph — PRD

## Original Problem Statement
> Build a website where we can upload any type of files (like PDF, Image, or any types), can be converted into any format, edited, and downloaded, with easy login, billing from config.

## Architecture
- **Backend**: FastAPI + MongoDB. JWT email/password auth (httpOnly cookies). File storage in Mongo as base64 (24h TTL). Conversions via PIL/pypdf/openpyxl/python-docx. Stripe checkout via `emergentintegrations`.
- **Frontend**: React 19 + Tailwind. Cormorant Garamond (serif) + IBM Plex Mono (mono) — "Old Money Tech" aesthetic, sharp corners, stone-50 base, #FF3B30 accent.

## User Personas
- **Free user** — converts ≤5 files/day, ≤25 MB.
- **Pro/Business subscribers** — higher daily limits, larger file sizes.
- **Pay-as-you-go user** — buys credit packs (50/200/1000).
- **Admin** (`admin@filemorph.app`) — seeded on startup.

## Core Requirements
1. Multi-format conversions: images, PDF, DOCX, TXT, CSV/TSV/JSON/XLSX, any→XLSX.
2. Advanced editing: image (crop/rotate/flip/B&W/invert/brightness/contrast/saturation/blur/sharpen + output format), PDF merge & split.
3. Auth: email/password JWT, login/register, protected routes.
4. Billing from config (`backend/config.py`): plans + credit packs, Stripe Checkout, polling + webhook.
5. Dashboard: usage stats, credit balance, conversion history.

## What's Been Implemented (2026-06-20)
- Auth: register/login/logout/me with httpOnly cookies + bcrypt.
- File upload → conversions/edit pipelines (sync, in-memory + Mongo store).
- Image editor with 9+ adjustments; PDF merge/split UI.
- Pricing page driven by `config.py`; Stripe Checkout + return-page polling + webhook.
- Landing, Dashboard with credit/usage tiles + history list.
- React-scripts dev server patched for webpack-dev-server v5.
- Admin seeded automatically.

## Backlog / Next
- P1: Emergent Google social login (toggle alongside JWT).
- P1: Audio/video conversions via ffmpeg (out of scope this iteration — needs ffmpeg install).
- P1: PDF rasterization (poppler/pdf2image) for true PDF→image pages.
- P2: Object storage (S3) for large persistent files (currently 24h Mongo).
- P2: Crop UI with handles (currently API-only crop[]).
- P2: Multi-file batch conversion / zip download.
