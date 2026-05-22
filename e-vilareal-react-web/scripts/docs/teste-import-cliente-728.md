# Teste funcional — import cliente 728 (pós-correção scripts)

## Recriar banco limpo

```bash
cd /Users/itamar/Documents/villareal
docker compose -f docker-compose.yml down vilareal-db
docker volume rm villareal_mysql_data 2>/dev/null || true
docker compose -f docker-compose.yml up -d vilareal-db
# Aguardar MySQL; depois subir backend para Flyway:
docker compose -f docker-compose.yml up -d vilareal-backend
# ou: cd e-vilareal-java-backend && ./run-dev.sh
```

## Import dry-run

```bash
cd e-vilareal-react-web
node scripts/import-real.mjs --cliente=728 --dry-run
```

## Import aplicar

```bash
cd e-vilareal-react-web
VILAREAL_IMPORT_SENHA='…' node scripts/import-real.mjs --cliente=728 --aplicar
```

## Validação SQL

```sql
SELECT p.id, p.numero_interno, p.cliente_id, c.codigo_cliente, p.pessoa_id, pe.nome AS titular
FROM processo p
JOIN cliente c ON c.id = p.cliente_id
JOIN pessoa pe ON pe.id = p.pessoa_id
WHERE c.codigo_cliente = '00000728'
LIMIT 10;

SELECT COUNT(*) FROM processo WHERE cliente_id IS NULL;

SELECT cliente_id, numero_interno, COUNT(*) AS n
FROM processo GROUP BY cliente_id, numero_interno HAVING n > 1;
```
