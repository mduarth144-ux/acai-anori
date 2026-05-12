# Contratos de Integracao iFood

Este documento define os contratos funcionais e tecnicos da integracao com a **Order API** e **Shipping API** do iFood: cada pedido da plataforma e publicado como pedido iFood (canal `DIGITAL_CATALOG`).

## Fluxos cobertos

- Criacao do pedido na **Order API do iFood** a partir do pedido criado no app (outbox).
- Atualizacao de status na Order API quando o status muda no **app / painel**.
- Recebimento de webhook/callback de eventos do iFood para sincronizacao no banco local.
- Reconciliacao periodica para pedidos sem confirmacao de webhook.

## Estados suportados

### Estados no app (`OrderStatus`)

- `PENDING`
- `CONFIRMED`
- `PREPARING`
- `READY`
- `DELIVERED`
- `CANCELLED`

### Estados na Order API iFood (`IfoodOrderStatus`)

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

## Armazenamento no modelo `Order`

- `ifoodResponse` (`jsonb`): respostas e estado da integração iFood (ids, `orderCreateApiResponse`, shipping, `syncState`, etc.).
- `integrationMeta` (`jsonb`): outras chaves (ex.: `integrationReady`, confirmação de entrega pelo cliente em `customer`).

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
