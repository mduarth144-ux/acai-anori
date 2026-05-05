# Playbook Operacional iFood

## Variaveis obrigatorias

- `IFOOD_CLIENT_ID`
- `IFOOD_CLIENT_SECRET`
- `IFOOD_MERCHANT_ID`
- `IFOOD_WEBHOOK_SECRET`
- `IFOOD_API_BASE_URL` (opcional)
- `IFOOD_AUTH_URL` (opcional)
- `IFOOD_SHIPPING_ENABLED` (opcional, default `true`)
- `IFOOD_SHIPPING_QUOTE_PATH` (opcional, default `/shipping/v1.0/quotes`)
- `IFOOD_SHIPPING_ORDER_PATH` (opcional, default `/shipping/v1.0/merchants/{merchantId}/orders`)
- `IFOOD_PICKUP_ADDRESS` (obrigatorio para pedidos `DELIVERY`)
- `INTERNAL_JOB_SECRET` (recomendado)

## Jobs recorrentes

- Processamento de outbox: `POST /api/integrations/ifood/outbox`
- Reconciliacao de status: `POST /api/integrations/ifood/reconcile`
- Saude da integracao: `GET /api/integrations/ifood/health`

## Alarmes recomendados

- Backlog de outbox `PENDING` acima de 50 por mais de 5 minutos.
- Taxa de falha da API iFood acima de 2% em 15 minutos.
- Eventos webhook `FAILED` acima de 5 em 10 minutos.

## Procedimento de reprocessamento

1. Investigar `IntegrationOutbox.lastError`.
2. Corrigir causa raiz (credencial, payload, conectividade).
3. Reenfileirar alterando status `FAILED` para `PENDING` e resetando `nextAttemptAt`.
4. Disparar endpoint de outbox manualmente com `x-job-secret`.

## Seguranca

- Exigir `x-job-secret` em todos endpoints internos de job.
- Rotacionar `IFOOD_WEBHOOK_SECRET` periodicamente.
- Nunca expor `IFOOD_CLIENT_SECRET` no frontend.
