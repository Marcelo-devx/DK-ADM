# Como Adicionar Pontos em Massa

## Funcionalidade
Esta funcionalidade permite adicionar pontos a múltiplos usuários de uma só vez usando um arquivo Excel, sem alterar o status/tier do clube.

## Como Usar

1. **Acesse o painel administrativo**
   - Faça login como administrador
   - Vá para o menu lateral → Clientes → "Adicionar Pontos em Massa"

2. **Prepare o arquivo Excel**
   - O arquivo deve ter as colunas:
     - `email` ou `Email` ou `EMAIL`: o email do usuário
     - `pontos` ou `Pontos` ou `PONTOS`: a quantidade de pontos a adicionar
   - Exemplo de formato:
     | Email | Pontos |
     |-------|--------|
     | joao@email.com | 100 |
     | maria@email.com | 50 |

3. **Faça upload do arquivo**
   - Clique em "Escolher arquivo"
   - Selecione o arquivo Excel (.xlsx ou .xls)
   - O sistema mostrará uma pré-visualização das 10 primeiras linhas

4. **Simule a importação**
   - Clique em "Simular Importação"
   - O sistema processará e mostrará quantos usuários serão afetados
   - Verifique o resumo:
     - ✅ **Sucesso**: usuários que receberão pontos
     - ❌ **Falhas**: erros de processamento
     - ⚠️ **Não encontrados**: emails que não existem no sistema

5. **Confirme e adicione os pontos**
   - Se a simulação estiver correta, clique em "Confirmar e Adicionar Pontos"
   - Os pontos serão adicionados ao perfil de cada usuário
   - O histórico de fidelidade será atualizado automaticamente
   - O status/tier do clube **NÃO será alterado**

6. **Baixe os resultados (opcional)**
   - Após processar, clique em "Baixar Resultados"
   - Você receberá um arquivo CSV com todos os detalhes

## O que acontece nos bastidores

1. O sistema lê o arquivo Excel
2. Para cada linha:
   - Busca o ID do usuário pelo email
   - Se encontrado, adiciona os pontos ao perfil (sem alterar tier)
   - Registra no histórico de fidelidade (operation_type: 'bonus')
   - Se não encontrado, marca como "não encontrado"

3. Não altera:
   - `tier_id` do usuário
   - `current_tier_name` do usuário
   - `last_tier_update` do usuário
   - Qualquer outro campo de perfil além de `points`

## Segurança

- Apenas administradores podem acessar esta funcionalidade
- O histórico de todas as operações é registrado em `loyalty_history`
- Você pode baixar um relatório detalhado de todas as alterações

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Usuário não encontrado" | Email não existe no sistema | Verifique se o email está cadastrado corretamente |
| "Email inválido ou pontos não informados" | Coluna ausente no Excel | Verifique se o arquivo tem as colunas "email" e "pontos" |
| "Erro ao processar arquivo" | Formato inválido do Excel | Use apenas arquivos .xlsx ou .xls |

## Suporte

Para dúvidas ou problemas, entre em contato com o suporte técnico.
