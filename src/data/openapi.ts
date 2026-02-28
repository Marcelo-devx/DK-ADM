// Minimal OpenAPI (Swagger) spec for the public N8N integration endpoints.
// Keep this lightweight - it is used by the dashboard to let users download / view the API spec.
export const openapi = {
  openapi: "3.0.1",
  info: {
    title: "N8N Integration API",
    version: "1.0.0",
    description: "API usada pelo N8N para consultar e atualizar pedidos do sistema (ex.: get-order-details, update-order-status).",
  },
  servers: [
    {
      url: "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1",
      description: "Edge Functions base URL"
    }
  ],
  paths: {
    "/get-order-details": {
      get: {
        summary: "Buscar pedido por ID",
        description: "Retorna dados completos do pedido incluindo items e perfil do cliente.",
        parameters: [
          { name: "id", in: "query", required: true, schema: { type: "string" }, description: "ID do pedido" }
        ],
        responses: {
          "200": { description: "OK - objeto do pedido" },
          "401": { description: "Unauthorized - token inválido" },
          "400": { description: "Bad Request - parametro faltando" }
        }
      }
    },
    "/update-order-status": {
      post: {
        summary: "Atualizar status do pedido",
        description: "Atualiza status ou informações de entrega de um pedido. Dispara triggers e webhooks (order_paid etc.).",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  order_id: { type: "integer" },
                  status: { type: "string" },
                  delivery_status: { type: "string" },
                  tracking_code: { type: "string" },
                  delivery_info: { type: "string" }
                },
                required: ["order_id"]
              }
            }
          }
        },
        responses: {
          "200": { description: "Pedido atualizado" },
          "401": { description: "Unauthorized" },
          "400": { description: "Bad Request" }
        }
      }
    }
  }
}
