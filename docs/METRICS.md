# 📊 Observabilidad y Métricas

El Chaos API Proxy expone métricas en formato **Prometheus** en el endpoint `/metrics`. Esto permite visualizar en tiempo real el tráfico, la latencia y, lo más importante, el caos inyectado.

## Acceso

- **Endpoint de métricas**: `http://localhost:8081/metrics`
- **Dashboard de Prometheus**: `http://localhost:9090` (si se usa Docker Compose)

## Métricas Disponibles

### 1. Tráfico Total

`chaos_proxy_requests_total` (Counter)
Cuenta el número total de peticiones procesadas.

**Labels:**

- `config_id`: ID de la configuración usada.
- `status_code`: Código HTTP de respuesta (ej: 200, 500, 503).
- `chaos_type`: Tipo de caos aplicado (`none`, `latency`, `error`, `drop_connection`).

**Ejemplo de consulta (PromQL):**

```promql
# Tasa de peticiones por segundo por código de estado
rate(chaos_proxy_requests_total[1m])
```

### 2. Latencia

`chaos_proxy_request_duration_seconds` (Histogram)
Distribución de la duración de las peticiones en segundos.

**Labels:**

- `config_id`: ID de la configuración.
- `chaos_type`: Tipo de caos aplicado.

**Ejemplo de consulta:**

```promql
# Latencia promedio (p99) en los últimos 5 minutos
histogram_quantile(0.99, rate(chaos_proxy_request_duration_seconds_bucket[5m]))
```

### 3. Inyecciones de Caos

`chaos_proxy_injections_total` (Counter)
Cuenta específicamente cuántas veces el Chaos Engine decidió inyectar una falla.

**Labels:**

- `config_id`: ID de la configuración.
- `injection_type`: `latency`, `error`, `drop_connection`, `bandwidth_limit`.

**Ejemplo de consulta:**

```promql
# Total de fallos inyectados por tipo
sum by (injection_type) (chaos_proxy_injections_total)
```

## Configuración de Prometheus

El proyecto incluye un servicio de Prometheus pre-configurado en `docker-compose.yml`. El archivo de configuración `prometheus.yml` hace scraping automático del proxy cada 15 segundos.

### Visualización Rápida

1. Abre http://localhost:9090
2. Escribe una expresión, por ejemplo: `chaos_proxy_requests_total`
3. Click en "Execute" y luego en la pestaña "Graph".

## Integración con Grafana (Opcional)

Si deseas conectar Grafana:

1. Añade Prometheus como Data Source (`http://prometheus:9090`).
2. Importa un dashboard y usa las métricas arriba descritas.
