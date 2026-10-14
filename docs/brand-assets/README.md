# 品牌源素材（不随网站发布）

这些文件于 2026-10-13 从 `public/` 移入本目录，内容和 Git blob SHA 不变。
它们是品牌导出稿或配色备选，不是运行时资源；`docs/` 已被 `.dockerignore` 排除。

网站、分享与 SEO 统一使用 `public/logo.png`。两个历史重复地址
`/logo-mark.png` 与 `/brand-kit/logo-avatar-transparent.png` 由 `next.config.mjs`
重写到 `/logo.png`，不再保存重复 PNG。

| 源素材 | 原路径 |
|---|---|
| `icon-1024.png` | `public/icon-1024.png` |
| `logo-mark-teal.png` | `public/logo-mark-teal.png` |
| `logo-mark-white.png` | `public/logo-mark-white.png` |
| `logo-avatar-transparent-512.png` | `public/brand-kit/logo-avatar-transparent-512.png` |
| `logo-square-512.png` | `public/brand-kit/logo-square-512.png` |
| `logo-square.png` | `public/brand-kit/logo-square.png` |

不要把这些备选稿重新整体复制到 `public/`。确需网站使用时，明确引用、尺寸与用途后再选入。
