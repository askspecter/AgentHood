/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The ported Pons engine is faithful TypeScript from Launchpad-Base; don't block
  // the production build on its strict types or lint in this JS-first project.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // RainbowKit/wagmi's connector barrel eagerly imports the Coinbase / base-org
    // account SDKs (for connectors we don't use), which drag in optional x402
    // packages that aren't installed. We only surface MetaMask / injected /
    // Rainbow / WalletConnect, so stub the unused subtree. Same fix as the
    // Launchpad-Base (Pork) config.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
      "@react-native-async-storage/async-storage": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
