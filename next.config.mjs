/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  turbopack: {
    // Turbopack-specific options can be added here if needed
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },

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
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
    // 图片格式优化
    formats: ["image/webp", "image/avif"],
    // 设备尺寸断点
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // 图片尺寸断点
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 服务端优化结果与浏览器均缓存 7 天，同一 URL/尺寸/质量会复用缓存
    minimumCacheTTL: 604800,
    // 允许的图片质量值（卡片/网格用低质量，封面/头像用中高质量）
    qualities: [72, 75, 80, 85],
  },
};

export default nextConfig;
