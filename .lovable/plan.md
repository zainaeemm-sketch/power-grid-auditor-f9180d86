
Update `src/lib/citation.ts` with the user's real info. All citation displays (`/about`, README, anywhere `CITATION` is imported) read from this single source, so one edit propagates everywhere.

Changes to `src/lib/citation.ts`:
- `authors`: `["Zain Naeem"]`
- `affiliation`: `"University of Palermo"`
- `url`: `"https://gridarena.eu"`
- Keep title, shortTitle, year (2026), version (1.0) as-is.

Also remove the helper note on `/about` ("Edit `src/lib/citation.ts` to personalize.") since personalization is done.

That's it — no other files reference these placeholder strings (verified the placeholders only live in `citation.ts`).
