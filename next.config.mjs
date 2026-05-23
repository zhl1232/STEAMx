/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
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
};

export default nextConfig;
