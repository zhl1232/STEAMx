/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Turbopack-specific options can be added here if needed
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },

      {
        protocol: 'https',
        hostname: 'lulfybqiiamdvbtdpqha.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
    // 图片格式优化
    formats: ['image/webp', 'image/avif'],
    // 设备尺寸断点
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // 图片尺寸断点
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 用户上传图片缓存 1 天，减少重复请求与带宽
    minimumCacheTTL: 86400,
    // 允许的图片质量值
    qualities: [85],
  },
};

export default nextConfig;
