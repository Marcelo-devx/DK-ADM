export interface TranslatedError {
  title: string;
  description: string;
  suggestion: string;
  severity: "critical" | "warning" | "info";
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  order_created: "Pedido Criado",
  order_updated: "Pedido Atualizado",
  pix_generated: "PIX Gerado",
  pix_payment_confirmed: "Pagamento PIX Confirmado",
  pix_expired: "PIX Expirado",
  card_payment_initiated: "Pagamento Cartão Iniciado",
  card_payment_approved: "Pagamento Cartão Aprovado",
  card_payment_rejected: "Pagamento Cartão Recusado",
  mercadopago_payment: "Mercado Pago — Pagamento",
  mercadopago_webhook: "Mercado Pago — Webhook",
  n8n_webhook: "N8N — Webhook",
  n8n_order_created: "N8N — Pedido Criado",
  n8n_order_updated: "N8N — Pedido Atualizado",
  email_sent: "E-mail Enviado",
  email_failed: "E-mail Falhou",
  webhook_sent: "Webhook Enviado",
  webhook_failed: "Webhook Falhou",
  customer_created: "Cliente Criado",
  support_contact_clicked: "Suporte Clicado",
  product_updated: "Produto Atualizado",
};

export function getEventLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export function translateError(
  eventType: string,
  responseCode: number | null,
  details: string | null
): TranslatedError {
  const d = details ?? "";
  const code = responseCode ?? 0;

  // ── N8N ──────────────────────────────────────────────────────────────────
  if (eventType.includes("n8n") || eventType.includes("webhook")) {
    if (code === 503 || containsAny(d, ["timeout", "ECONNREFUSED", "ETIMEDOUT", "connect"])) {
      return {
        title: "N8N não respondeu",
        description: "O servidor N8N não está acessível ou demorou demais para responder.",
        suggestion: "Verifique se o workflow está ativo e se a URL do webhook está correta.",
        severity: "critical",
      };
    }
    if (code === 404 || containsAny(d, ["not found", "404"])) {
      return {
        title: "Webhook N8N não encontrado",
        description: "A URL do webhook não existe ou foi alterada no N8N.",
        suggestion: "Confirme a URL do webhook na aba Gatilhos e atualize se necessário.",
        severity: "critical",
      };
    }
    if (code === 401 || code === 403 || containsAny(d, ["unauthorized", "forbidden", "token"])) {
      return {
        title: "Acesso negado ao N8N",
        description: "O token de autenticação foi rejeitado pelo N8N.",
        suggestion: "Verifique o Bearer Token configurado na página de N8N.",
        severity: "critical",
      };
    }
    if (code >= 500) {
      return {
        title: "Erro interno no N8N",
        description: "O N8N recebeu a requisição mas falhou ao processá-la.",
        suggestion: "Verifique os logs do workflow no painel do N8N para mais detalhes.",
        severity: "critical",
      };
    }
    if (code === 0 || containsAny(d, ["network", "fetch", "dns"])) {
      return {
        title: "Falha de rede ao chamar N8N",
        description: "Não foi possível estabelecer conexão com o servidor N8N.",
        suggestion: "Verifique se o N8N está online e se a URL está acessível.",
        severity: "critical",
      };
    }
  }

  // ── MERCADO PAGO ─────────────────────────────────────────────────────────
  if (eventType.includes("mercadopago") || eventType.includes("card") || eventType.includes("pix")) {
    if (code === 401 || containsAny(d, ["invalid_token", "access_token", "unauthorized"])) {
      return {
        title: "Token do Mercado Pago inválido",
        description: "O Access Token do Mercado Pago foi rejeitado.",
        suggestion: "Reconfigure o token na página de Integrações → Mercado Pago.",
        severity: "critical",
      };
    }
    if (code === 422 || containsAny(d, ["cc_rejected", "rejected", "recusado", "declined"])) {
      if (containsAny(d, ["insufficient", "saldo", "funds"])) {
        return {
          title: "Cartão recusado — saldo insuficiente",
          description: "O banco emissor recusou o pagamento por saldo insuficiente.",
          suggestion: "O cliente deve tentar outro cartão ou método de pagamento.",
          severity: "critical",
        };
      }
      if (containsAny(d, ["bad_filled", "invalid", "dados"])) {
        return {
          title: "Dados do cartão inválidos",
          description: "O número, validade ou CVV do cartão estão incorretos.",
          suggestion: "O cliente deve verificar os dados do cartão e tentar novamente.",
          severity: "critical",
        };
      }
      if (containsAny(d, ["high_risk", "fraud", "fraude"])) {
        return {
          title: "Transação bloqueada por risco",
          description: "O Mercado Pago bloqueou a transação por suspeita de fraude.",
          suggestion: "Entre em contato com o suporte do Mercado Pago ou solicite outro método.",
          severity: "critical",
        };
      }
      return {
        title: "Pagamento recusado pelo Mercado Pago",
        description: "O Mercado Pago não aprovou esta transação.",
        suggestion: "Verifique os detalhes do erro e oriente o cliente a tentar novamente.",
        severity: "critical",
      };
    }
    if (code === 400 || containsAny(d, ["bad_request", "invalid_param", "missing"])) {
      return {
        title: "Dados de pagamento inválidos",
        description: "A requisição enviada ao Mercado Pago contém dados incorretos ou incompletos.",
        suggestion: "Verifique os dados do pedido e tente re-disparar.",
        severity: "warning",
      };
    }
    if (containsAny(d, ["pix_expired", "expirado", "expired"])) {
      return {
        title: "PIX expirado",
        description: "O QR Code PIX expirou antes do cliente efetuar o pagamento.",
        suggestion: "Gere um novo PIX para o cliente ou cancele o pedido.",
        severity: "warning",
      };
    }
    if (code === 503 || containsAny(d, ["service_unavailable", "timeout", "unavailable"])) {
      return {
        title: "Mercado Pago indisponível",
        description: "O serviço do Mercado Pago está temporariamente fora do ar.",
        suggestion: "Aguarde alguns minutos e tente re-disparar a operação.",
        severity: "warning",
      };
    }
    if (code >= 500) {
      return {
        title: "Erro interno no Mercado Pago",
        description: "O Mercado Pago retornou um erro inesperado.",
        suggestion: "Tente novamente em alguns instantes. Se persistir, contate o suporte.",
        severity: "critical",
      };
    }
  }

  // ── EMAIL ─────────────────────────────────────────────────────────────────
  if (eventType.includes("email")) {
    if (containsAny(d, ["invalid_email", "bounce", "invalid address"])) {
      return {
        title: "E-mail inválido ou inexistente",
        description: "O endereço de e-mail do cliente não existe ou está com erro.",
        suggestion: "Verifique o e-mail cadastrado pelo cliente.",
        severity: "warning",
      };
    }
    return {
      title: "Falha ao enviar e-mail",
      description: "O serviço de e-mail não conseguiu entregar a mensagem.",
      suggestion: "Verifique as configurações do Resend/SMTP e tente novamente.",
      severity: "warning",
    };
  }

  // ── GENÉRICO por código HTTP ──────────────────────────────────────────────
  if (code === 401 || code === 403) {
    return {
      title: "Acesso não autorizado",
      description: `Código ${code}: A requisição foi rejeitada por falta de permissão.`,
      suggestion: "Verifique os tokens e credenciais da integração.",
      severity: "critical",
    };
  }
  if (code === 404) {
    return {
      title: "Recurso não encontrado",
      description: `Código 404: O endpoint ou recurso solicitado não existe.`,
      suggestion: "Verifique a URL configurada na integração.",
      severity: "warning",
    };
  }
  if (code === 422) {
    return {
      title: "Dados inválidos na requisição",
      description: `Código 422: Os dados enviados foram rejeitados pelo servidor.`,
      suggestion: "Verifique o payload do pedido e tente re-disparar.",
      severity: "warning",
    };
  }
  if (code >= 500) {
    return {
      title: "Erro interno no servidor",
      description: `Código ${code}: O servidor retornou um erro inesperado.`,
      suggestion: "Tente re-disparar. Se persistir, verifique os logs do servidor.",
      severity: "critical",
    };
  }
  if (code === 0 || containsAny(d, ["network", "fetch failed", "connection"])) {
    return {
      title: "Falha de conexão",
      description: "Não foi possível conectar ao serviço externo.",
      suggestion: "Verifique a conectividade e se o serviço está online.",
      severity: "critical",
    };
  }

  // Fallback
  return {
    title: "Erro desconhecido",
    description: details ?? "Ocorreu um erro não identificado nesta etapa.",
    suggestion: "Verifique os logs completos e tente re-disparar a operação.",
    severity: "warning",
  };
}
