# Contributing

Thanks for wanting to help. Bug reports, fixes, documentation improvements and ideas are all welcome. Jellypass is a one-person hobby project, so please be patient with replies.

- **Found a security problem?** Do not open a public issue; follow [SECURITY.md](SECURITY.md).
- **Something not working?** Check [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) first, then open a bug report. The form asks for the details that make it quick to fix.
- **Want a feature?** Open a feature request and describe the problem you are trying to solve before the solution. For anything large, please talk it through in an issue before writing code.

## Setting up

You need Node.js 24 and Docker.

```sh
git clone https://github.com/Ol775/Jellypass.git
cd Jellypass
npm ci
npm test            # about 600 tests
npm run typecheck
```

To try your change in the real thing, build and run the image:

```sh
docker build -t jellypass:dev .
docker run --rm -p 8787:8787 -v jellypass-dev-data:/data jellypass:dev
```

Then open `http://localhost:8787`. You need a Jellyfin server for the setup wizard to connect to.

## How the code is laid out

| Path | What it is |
| --- | --- |
| `src/` | The application (Hono). It was written as a Cloudflare Worker and `selfhost/` runs it on Node |
| `src/routes/` | HTTP routes. Every `/api/admin/*` route needs a session and a fresh admin check |
| `src/views/` | Pages are server-rendered strings; the browser scripts are in `src/views/js/`, styles in `src/views/css*.ts` |
| `selfhost/` | The Docker server: SQLite for the database, a folder for files, SMTP for email, the setup wizard, the Server settings, HTTPS and the update check |
| `migrations/` | Database migrations. Add a new numbered file; never edit an old one |
| `test/` | The test suite |
| `docs/` | The guides |

## Rules the code follows

- **Tests first.** Add or change a test with every behaviour change. `npm test` and `npm run typecheck` must pass.
- **No inline scripts or style attributes.** The Content Security Policy forbids them; use classes.
- **No web addresses in the admin scripts or pages.** A test checks that the admin JavaScript and pages contain no literal `http://` or `https://`, so nothing is loaded from or linked to a third party. Link text can name a site without a scheme.
- **Never log or store secrets.** Keys, tokens, passwords and codes must not reach logs, the audit log or error messages.
- **Validate at the edge.** Anything that comes from a request is checked before it is used.
- **British English** in text shown to people.
- **Keep changes small and focused.** Match the style around you.

## Changelog and versions

Add a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) (create the heading above the newest version if it is missing) for anything a user would notice. The maintainer chooses the version and cuts releases; a test checks the changelog and `package.json` agree.

## Pull requests

1. Fork, make a branch, and keep the pull request to one thing.
2. Run the tests and the type check.
3. Fill in the pull request template: what changed, why, and how you tested it.
4. For visible changes, a screenshot helps.

By contributing you agree that your contribution is licensed under the project's [MIT licence](LICENSE).

See also the [Code of Conduct](CODE_OF_CONDUCT.md).
