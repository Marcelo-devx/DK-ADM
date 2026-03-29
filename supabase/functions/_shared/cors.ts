// @ts-nocheck

// 🔒 SECURE CORS MODULE WITH ORIGIN WHITELIST

const ALLOWED_ORIGINS = [
  'https://clubdk.com.br',
  'https://www.clubdk.com.br',
  // Adicionar domínios reais em produção
  'http://localhost:5173', // Dev
  'http://localhost:8080', // Vite dev
];

export function buildSecureCorsHeaders(origin: string | null) {
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin?.startsWith(allowed));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE, PUT',
    'Vary': 'Origin',
  };
}

export function checkOrigin(origin: string | null, reqMethod: string): { isAllowed: boolean } {
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin?.startsWith(allowed));
  
  // OPTIONS requests are always allowed (CORS preflight)
  if (reqMethod === 'OPTIONS') {
    return { isAllowed: true };
  }
  
  return { isAllowed };
}