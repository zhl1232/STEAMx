import type { ImageProps } from 'next/image'

// Vite fixture adapter: use the native image element without Next's image server.
export default function Image({ fill, src, unoptimized: _unoptimized, priority: _priority, placeholder: _placeholder, blurDataURL: _blurDataURL, quality: _quality, loader: _loader, ...props }: ImageProps) {
  const nativeSrc = typeof src === 'string' ? src : 'default' in src ? src.default.src : src.src
  // eslint-disable-next-line nextjs/no-img-element -- Native rendering is intentional in this isolated fixture adapter.
  return <img {...props} src={nativeSrc} style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...props.style } : props.style} />
}
