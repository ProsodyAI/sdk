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

## Promotion and release

Push SDK changes to `dev`. A successful CI run for the current `dev` head opens
or updates the `dev` to `main` pull request. It never merges the pull request or
enables auto-merge. Configure `PROSODYAI_RELEASE_TOKEN` with Contents read and
Pull requests write access only to this repository, or open the promotion pull
request manually.

Publishing is separate from merging. To release:

1. Update `package.json` to the intended version and change the README install
   command from GitHub to `npm install @prosodyai/sdk`.
2. Merge those changes through `dev`.
3. Create and push `v<package-version>` at that commit on `main`.
4. Approve the `npm` environment deployment when the release workflow pauses.

The release job runs only when the `NPM_PUBLISH_ENABLED` repository variable is
`true`. The `npm` environment must have required reviewers and must provide an
`NPM_TOKEN` for the first publish. After the package exists, configure npm
trusted publishing for `release.yml`; the workflow already requests the OIDC
and provenance permissions it needs.

After a green `main` CI run, the SDK sends the exact commit SHA to the root
`ProsodyAI/prosodyai` repository. Configure a fine-grained
`PROSODYAI_ROOT_DISPATCH_TOKEN` with Contents write access only to that root
repository. If the token is absent, the workflow exits successfully and the
root repository's scheduled reconciliation remains the fallback.
