/**
 * Adiciona transformações automáticas de otimização em URLs do Cloudinary.
 * - f_auto: converte para WebP/AVIF automaticamente conforme o browser suporta
 * - q_auto: qualidade automática otimizada pelo Cloudinary
 * - w_<maxWidth>: redimensiona para a largura máxima especificada
 *
 * URLs que não são do Cloudinary são retornadas sem alteração.
 */
export function optimizeCloudinaryUrl(url: string | null | undefined, maxWidth = 900): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com')) return url;

  // Evita duplicar transformações se já foram aplicadas
  if (url.includes('f_auto') || url.includes('q_auto')) return url;

  // Insere as transformações após "/upload/"
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${maxWidth}/`);
}
