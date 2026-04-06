// Função para traduzir erros comuns do PostgreSQL/Supabase
export const translateDatabaseError = (error: any): string => {
  const errorMessage = error?.message || String(error);
  
  // Mapeamento de erros comuns
  const errorMap: Record<string, string> = {
    'relation "cupons" does not exist': 'Erro interno: Tabela de cupons não encontrada. Por favor, recarregue a página e tente novamente.',
    'relation "coupons" does not exist': 'Erro interno: Tabela de cupons não encontrada. Por favor, recarregue a página e tente novamente.',
    'duplicate key': 'Este registro já existe.',
    'foreign key': 'Não é possível excluir este registro pois existem dados relacionados.',
    'permission denied': 'Você não tem permissão para realizar esta ação.',
    'violates check constraint': 'Os dados fornecidos não são válidos.',
    'null value': 'Preencha todos os campos obrigatórios.',
    'Sessão expirada': 'Sessão expirada. Por favor, faça login novamente.',
    'Failed to fetch': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'Cupom não encontrado': 'O cupom selecionado não foi encontrado.',
    'Cupom não está ativo': 'Este cupom não está ativo no momento.',
    'Cupom esgotado': 'Este cupom está esgotado.',
    'Pontos insuficientes': 'Você não tem pontos suficientes para resgatar este cupom.',
    'Cliente já atingiu o limite de uso deste cupom': 'Este cliente já atingiu o limite de uso deste cupom.',
    'network error': 'Erro de rede. Verifique sua conexão com a internet.',
    'timeout': 'A operação demorou muito tempo. Tente novamente.',
    'unauthorized': 'Você não está autorizado a realizar esta ação.',
  };
  
  // Verifica se há correspondência exata
  for (const [key, value] of Object.entries(errorMap)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Retorna mensagem original se não houver tradução, mas remove detalhes técnicos
  if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
    const tableName = errorMessage.match(/"([^"]+)"/)?.[1] || 'tabela';
    return `Erro interno: A tabela ${tableName} não foi encontrada. Por favor, contate o suporte técnico.`;
  }
  
  return errorMessage;
};
