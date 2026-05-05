# Runbook de Funcionalidades Basicas iFood

## Endpoints internos (operacao)

- `GET /api/integrations/ifood/orders?ifoodOrderId=...`
- `POST /api/integrations/ifood/orders` com `action`:
  - `START_PREPARATION`
  - `READY_FOR_PICKUP`
  - `OUT_FOR_DELIVERY`
- `GET /api/integrations/ifood/cancellation?ifoodOrderId=...`
- `POST /api/integrations/ifood/cancellation`
- `GET /api/integrations/ifood/catalog?action=catalogs|categories|products|restricted-items`
- `POST /api/integrations/ifood/catalog` com `action` de sync/CRUD/lote
- `GET /api/integrations/ifood/store?action=details|hours|interruptions`
- `POST /api/integrations/ifood/store` com `action` de horarios/interrupcoes

## Operacao recomendada diaria

1. Verificar saude em `GET /api/integrations/ifood/health`.
2. Se houver backlog, disparar `POST /api/integrations/ifood/outbox`.
3. Para reconciliar status, disparar `POST /api/integrations/ifood/reconcile`.
4. Verificar eventos com falha na tabela `IfoodWebhookEvent`.

## Incidentes comuns

- `401 unauthorized`:
  - Validar `INTERNAL_JOB_SECRET` / `CRON_SECRET`.
- `Erro ao autenticar no iFood`:
  - Validar `IFOOD_CLIENT_ID` e `IFOOD_CLIENT_SECRET`.
- `Falha de payload`:
  - Inspecionar `integration.ifood.syncError` e `outbox.lastError`.

## KPI minimo de observabilidade

- Pendencias de outbox (`PENDING`) abaixo de 20.
- Falhas de outbox (`FAILED`) igual a 0.
- Falhas de webhook (`processingStatus=FAILED`) igual a 0.
- Latencia media das chamadas iFood abaixo de 2s.
