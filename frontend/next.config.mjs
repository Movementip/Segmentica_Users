import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    experimental: {
        cpus: 1,
        gzipSize: false,
        serverMinification: false,
        staticGenerationMaxConcurrency: 1,
        staticGenerationMinPagesPerWorker: 1,
        webpackBuildWorker: false,
        webpackMemoryOptimizations: true,
    },
    turbopack: {
        root: frontendRoot,
    },
    async rewrites() {
        const defaultApiUrl = process.env.NODE_ENV === "production"
            ? "http://tailscale:3001"
            : "http://127.0.0.1:3001";
        const apiUrl = (process.env.FRONTEND_API_INTERNAL_URL || defaultApiUrl).replace(/\/+$/, "");

        return [
            {
                source: "/api/:path*",
                destination: `${apiUrl}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
