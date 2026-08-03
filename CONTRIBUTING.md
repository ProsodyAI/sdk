# Contributing

## Development

Use Node.js 18 or newer.

```bash
npm ci
npm run build
npm run typecheck
npm test
npm pack --dry-run
```

The generated `dist/` output is tracked. Run the build after changing public
types or implementation code.

## Pull requests

Keep each pull request focused and add tests for public behavior. Do not commit
API keys, customer audio, transcripts, speaker profiles, or production response
fixtures. Describe any public API or wire-format change in the pull request.
