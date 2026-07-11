/** @type {import('next').NextConfig} */

function buildAssetsRemotePatterns() {
  const baseUrl = process.env.NEXT_PUBLIC_ASSETS_BASE_URL
  if (!baseUrl) return []

  try {
    const url = new URL(baseUrl)
    const protocol = url.protocol.replace(':', '')
    if (protocol !== 'http' && protocol !== 'https') return []
    return [{ protocol, hostname: url.hostname }]
  } catch {
    return []
  }
}

function buildScratchAssetDestination() {
  const baseUrl = process.env.NEXT_PUBLIC_ASSETS_BASE_URL?.trim().replace(/\/+$/, '')
  if (!baseUrl) return '/scratch/assets/:md5ext'

  const isProduction = process.env.NODE_ENV === 'production'
  const useDirectDisplay = process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE === 'direct'
  if (!isProduction && !useDirectDisplay) {
    return '/api/assets/scratch/assets/:md5ext'
  }

  return `${baseUrl}/scratch/assets/:md5ext`
}

function buildAllowedDevOrigins() {
  const extraOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return [...new Set(['127.0.0.1', 'localhost', ...extraOrigins])]
}

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: buildAllowedDevOrigins(),
  skipTrailingSlashRedirect: true,
  turbopack: {
    // Turbopack-specific options can be added here if needed
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
        search: "",
      },
      {
        pathname: "/projects/generated/**",
        search: "?v=20260522-tech-images",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.opentrust.net",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      ...buildAssetsRemotePatterns(),
    ],
    // 图片格式优化
    formats: ["image/webp"],
    // 设备尺寸断点
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // 图片尺寸断点
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 服务端优化结果与浏览器均缓存 7 天，同一 URL/尺寸/质量会复用缓存
    minimumCacheTTL: 604800,
    qualities: [48, 60, 72, 75],
  },
  async redirects() {
    return [
      {
        source: '/community',
        destination: '/create',
        permanent: true,
      },
      {
        source: '/community/challenge/:id',
        destination: '/pbl/:id',
        permanent: true,
      },
      {
        source: '/community/challenge/:id/submit',
        destination: '/pbl/:id/submit',
        permanent: true,
      },
      {
        source: '/community/discussion/:path*',
        destination: '/create',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/gomoku-rapfi/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        // scratch-gui.js 的文件名固定，避免用户长期缓存旧编辑器；其它运行时文件也复用一天。
        source: '/scratch/scratch-gui.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/scratch/vendor/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Scratch 造型/声音等素材：内容按 md5 寻址，可长期缓存
        source: '/scratch/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/internalapi/asset/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/scratch/chunks/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  async rewrites() {
    const scratchAssetDestination = buildScratchAssetDestination()
    return [
      {
        // scratch-storage FetchWorker 默认去 /chunks/xxx，产物在 /scratch/chunks/
        // 注意：:param 前必须有分隔符，不能写成 fetch-worker:path*
        source: '/chunks/:file',
        destination: '/scratch/chunks/:file',
      },
      {
        source: '/internalapi/asset/:md5ext/get/',
        destination: scratchAssetDestination,
      },
      {
        source: '/internalapi/asset/:md5ext/get',
        destination: scratchAssetDestination,
      },
    ]
  },
};

export default nextConfig;
