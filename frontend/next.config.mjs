import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {
        root: frontendRoot,
    },
    async rewrites() {
        const apiUrl = (process.env.FRONTEND_API_INTERNAL_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");

        return [
            {
                source: "/api/:path*",
                destination: `${apiUrl}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
