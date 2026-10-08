/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io'], // For NFT avatar loading from IPFS
  },
}

module.exports = nextConfig
