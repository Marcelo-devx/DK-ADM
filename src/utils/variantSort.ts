/**
 * Utilitário para ordenar variações de produtos por especificação
 * Critérios: sabor → cor → tamanho → volume → ohms
 */

export const sortVariantsBySpecification = (variants: any[]): any[] => {
  return [...variants].sort((a, b) => {
    const flavorA = a.flavors?.name || '';
    const flavorB = b.flavors?.name || '';
    
    // Comparar por sabor (critério principal)
    if (flavorA !== flavorB) {
      return flavorA.localeCompare(flavorB, 'pt-BR');
    }
    
    // Comparar por cor (critério secundário)
    const colorA = a.color || '';
    const colorB = b.color || '';
    if (colorA !== colorB) {
      return colorA.localeCompare(colorB, 'pt-BR');
    }
    
    // Comparar por tamanho (critério terciário)
    const sizeA = a.size || '';
    const sizeB = b.size || '';
    if (sizeA !== sizeB) {
      return sizeA.localeCompare(sizeB, 'pt-BR');
    }
    
    // Comparar por volume (critério quaternário - numérico)
    if (a.volume_ml !== b.volume_ml) {
      return (a.volume_ml || 0) - (b.volume_ml || 0);
    }
    
    // Comparar por ohms (critério quinário)
    const ohmsA = a.ohms || '';
    const ohmsB = b.ohms || '';
    return ohmsA.localeCompare(ohmsB, 'pt-BR');
  });
};
