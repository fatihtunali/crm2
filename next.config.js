/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Hide X-Powered-By header

  // Suppress third-party library warnings in console
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Suppress React strict mode warnings from third-party libraries
      const originalWarn = console.warn;
      console.warn = (...args) => {
        const msg = args[0];
        if (
          typeof msg === 'string' &&
          (msg.includes('UNSAFE_componentWillReceiveProps') ||
           msg.includes('ModelCollapse'))
        ) {
          return; // Suppress this specific warning
        }
        originalWarn(...args);
      };
    }
    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      },
      {
        // Additional headers for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow'
          }
        ]
      }
    ];
  },

  // Image optimization configuration
  images: {
    domains: ['maps.googleapis.com'], // Google Places photos
    formats: ['image/avif', 'image/webp']
  }
}

module.exports = nextConfig
