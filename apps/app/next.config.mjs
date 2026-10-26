import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
    // Output standalone để build Docker image gọn (server tự chứa, không cần node_modules đầy đủ)
    output: 'standalone',
    // Monorepo có lockfile ở cả root và apps/app. Khai báo rõ tracing root
    // để Next không suy đoán sai workspace và không đưa file ngoài app vào image.
    outputFileTracingRoot: appRoot,
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [{
                protocol: "https",
                hostname: "cdn.sanity.io",
                port: ""
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                port: ""
            },
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
                port: ""
            },
            {
                protocol: "https",
                hostname: "pub-b7fd9c30cdbf439183b75041f5f71b92.r2.dev",
                port: ""
            }
        ],
        formats: ['image/avif', 'image/webp'],
    },
    env: {
        API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8000',
    },
    // Performance optimizations
    compress: true,
    poweredByHeader: false,
    reactStrictMode: true,
    // Enable experimental features for better performance
    experimental: {
        optimizeCss: true, // Requires 'critters' package (installed)
    },
    // Compiler optimizations
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? {
            exclude: ['error', 'warn'],
        } : false,
    },
    // Security headers (additional layer, middleware handles most)
    async headers() {
        const apiOrigin = process.env.API_BASE_URL || 'http://localhost:8000';
        // 'unsafe-eval' is only needed for webpack/React-Refresh HMR in dev; it must
        // never ship to production (it re-opens eval-based XSS). Prod build drops it.
        const isDev = process.env.NODE_ENV !== 'production';
        const scriptSrc = [
            "script-src 'self' 'unsafe-inline'",
            isDev ? "'unsafe-eval'" : '',
            'https://*.zalo.me https://*.zaloapp.com',
        ].filter(Boolean).join(' ');
        const csp = [
            "default-src 'self'",
            // Styles and fonts
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data: https:",
            // Images and media
            "img-src 'self' data: blob: https:",
            // Audio/video (quiz question media, blob: for local previews before upload completes)
            "media-src 'self' data: blob: https:",
            // Scripts (inline needed by Next; eval only in dev for HMR)
            scriptSrc,
            // XHR/Websocket/API — explicit origins only (no bare `https:` wildcard,
            // which would allow exfiltration to ANY https host). The app talks to its
            // own origin (BFF) and the backend API origin.
            `connect-src 'self' ${apiOrigin}`,
            // Framing - Allow Zalo domains
            "frame-ancestors 'self' https://*.zalo.me https://*.zaloapp.com",
        ].join('; ');

        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'Content-Security-Policy', value: csp },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'X-Download-Options', value: 'noopen' },
                ],
            },
        ];
    },
};

export default nextConfig;