import type { NextConfig } from 'next';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const nextConfig: NextConfig = {
	allowedDevOrigins: [`${process.env.BASE_URL}`],
	images: {
		remotePatterns: [
			{
				protocol: 'http',
				hostname: `${process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/^https?:\/\//, '')}`,
				port: '3000',
				pathname: '/**',
			},
		],
	},
};

export default nextConfig;
