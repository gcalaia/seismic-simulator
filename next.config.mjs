/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para manejar paquetes de Firebase correctamente
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  
  webpack: (config, { isServer }) => {
    // Excluir firebase-admin del bundle del cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'firebase-admin': false,
        'firebase-admin/app': false,
        'firebase-admin/database': false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
