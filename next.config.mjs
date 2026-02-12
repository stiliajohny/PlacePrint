/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/*": ["./themes/**/*.json", "./fonts/**/*.ttf"]
    }
  }
};

export default nextConfig;
