# Production server config copies (managed by ops/wenyan-deploy)

| File here | Server path | Notes |
|---|---|---|
| `logrotate-nginx` | `/etc/logrotate.d/nginx` | ICP filing: keep Nginx access logs >= 180 days -> `daily` + `rotate 200`. The deploy script (embedded in `.github/workflows/ops-readonly-media-inspect.yml` on this branch) rewrites the server file when it differs only in the `rotate` line (e.g. a package upgrade reset it to the Ubuntu default `rotate 14`), backs up the previous file to `/root/ops-backups/wenyan-<ts>/`, validates with `logrotate -d` and restores on failure. Any other difference is reported as DRIFT and left untouched. |

Never put backup copies inside `/etc/logrotate.d/` (logrotate parses every file there; a `nginx.bak.*` file broke every run from 2026-09-25 to 2026-10-04).
