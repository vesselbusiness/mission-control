/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "chem-recall-watershed-wallet.trycloudflare.com",
    ...(process.env.ALLOWED_DEV_ORIGINS
      ? process.env.ALLOWED_DEV_ORIGINS.split(",")
      : []),
  ],
};

export default nextConfig;
