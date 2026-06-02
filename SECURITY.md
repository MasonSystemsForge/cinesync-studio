# Security Policy

## Secrets and credentials

Do not commit real environment files, API keys, provider tokens, webhook secrets, private media links, client files, voice data, or production credentials.

Use `.env.example` for placeholders only. Keep real values in local `.env` files or a managed secret store.

## Media safety

This project may handle video, audio, generated media, subtitles, and exports. Avoid committing private client assets, raw uploads, rendered output, or licensed media.

## If a secret was committed

1. Remove the secret from the repository.
2. Rotate or revoke the exposed key in the provider dashboard.
3. Audit logs for unauthorized use.
4. Replace local credentials with fresh values.

## Reporting

Track security findings privately before publishing fixes.
