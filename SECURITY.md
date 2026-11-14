# Security policy

Marchlands is a hobby project with one maintainer. Reports are read and answered as time allows, and a confirmed problem is fixed on `main`.

## Reporting a vulnerability

**Report it privately, not in a public issue or pull request.**

Use GitHub's private reporting: on the repository's [Security tab](https://github.com/barrymun/marchlands/security), choose **Report a vulnerability** ([open a report](https://github.com/barrymun/marchlands/security/advisories/new)). Only the maintainer sees it.

A report is most useful with:

- what an attacker gains (another player's account, their data, the server);
- the steps to reproduce it, against a stack of your own (README.md, Play it on your own computer);
- the commit you tested.

Please give the maintainer time to fix it before writing about it in public. You're credited in the fix unless you'd rather not be.

## What's covered

- **The code on `main`.** There are no releases and no older versions kept up: a fix lands on `main`, and a server is updated by pulling it ([docs/deployment.md](docs/deployment.md)).
- **In scope:** the API and push socket (`backend/`), the web client (`client/web`), and the images and Compose files a server runs.
- **Test your own stack only.** Someone else's server, and its players' accounts, are theirs: tell that server's operator about a problem with how it's set up.

## What isn't a vulnerability here

- **A server left on the development settings.** The settings a server must change before players join are listed in the README ([Settings you must change](README.md#settings-you-must-change)); the API refuses to start in production with a guessable `JWT_SECRET`.
- **A way to get ahead in the game** that doesn't cross into another player's account or data (an exploit of the rules, a balance problem): open an ordinary issue.
- **A dependency's advisory** with no way to reach it through Marchlands.

## For server operators

- [README.md, Settings you must change](README.md#settings-you-must-change): the settings that make a server safe.
- [docs/deployment.md](docs/deployment.md): HTTPS, what the web container guards (the login limit, the security headers) and how to end every login.
- [docs/features/shannon-pentest.md](docs/features/shannon-pentest.md): the penetration test run against the game, and what was changed after it.
