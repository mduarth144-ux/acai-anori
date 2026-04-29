# Contratos de Integracao iFood (Outbound)

Este documento define os contratos funcionais e tecnicos usados pela integracao outbound com iFood.

## Fluxos cobertos

- Criacao de pedido no iFood a partir de pedido criado na plataforma.
- Atualizacao de status no iFood quando o status muda no sistema interno.
- Recebimento de webhook/callback de eventos do iFood para sincronizacao no banco local.
- Reconciliacao periodica para pedidos sem confirmacao de webhook.

## Estados suportados

### Estados internos (`OrderStatus`)

- `PENDING`
- `CONFIRMED`
- `PREPARING`
- `READY`
- `DELIVERED`
- `CANCELLED`

### Estados externos normalizados (`IfoodOrderStatus`)

- `PLACED`
- `CONFIRMED`
- `PREPARING`
- `READY_FOR_DELIVERY`
- `DELIVERED`
- `CANCELLED`

## Mapeamento de status

- `PENDING` -> `PLACED`
- `CONFIRMED` -> `CONFIRMED`
- `PREPARING` -> `PREPARING`
- `READY` -> `READY_FOR_DELIVERY`
- `DELIVERED` -> `DELIVERED`
- `CANCELLED` -> `CANCELLED`

## Eventos de webhook esperados

### Contrato minimo do evento inbound

```json
{
  "eventId": "string-unico",
  "eventType": "ORDER_STATUS_CHANGED",
  "merchantId": "string",
  "orderId": "ifood-order-id",
  "status": "DELIVERED",
  "occurredAt": "2026-01-01T12:00:00.000Z",
  "payload": {}
}
```

### Regras de processamento

- `eventId` deve ser idempotente (ignorar duplicados).
- `merchantId` deve bater com `IFOOD_MERCHANT_ID`.
- Processamento deve persistir trilha de auditoria com payload original.
- Eventos invalidos devem retornar erro 4xx sem atualizar pedido.

## Requisitos de seguranca

- Validacao de assinatura do webhook via `IFOOD_WEBHOOK_SECRET`.
- Segregacao de credenciais por ambiente.
- Redaction de campos sensiveis em logs quando aplicavel.

## Requisitos de confiabilidade

- Outbox transacional para envio outbound.
- Retry exponencial com jitter para erros 5xx/network.
- Reprocessamento manual de falhas via endpoint interno protegido.
- Reconciliacao periodica para fechar divergencias de estado.
