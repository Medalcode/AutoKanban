# 📔 Bitácora de Proyecto

## 📅 [2026-01-25] Refactorización a Arquitectura Hexagonal

Se ha realizado una refactorización completa del backend para mejorar la escalabilidad y mantenibilidad.

### ✅ Tareas Realizadas

1.  **Reestructuración de Directorios**
    - Creación de estructura hexagonal: `src/core`, `src/application`, `src/infrastructure`, `src/api`.
    - Migración de lógica de negocio a `src/core/domain`.

2.  **Domain Layer (Núcleo)**
    - Definición de tipos centrales en `src/core/domain/types.ts`.
    - Migración de `ChaosEngine` a `src/core/domain/ChaosEngine.ts`.
    - Migración de `ScriptEngine` a `src/core/domain/ScriptEngine.ts`.
    - Definición de interfaces de repositorio (Port) en `src/core/interfaces/repositories.ts`.

3.  **Infrastructure Layer (Adaptadores)**
    - Implementación de Repositorios Redis: `RedisConfigRepository` y `RedisLogRepository`.
    - Implementación de servicios de Rate Limit en `src/infrastructure/ratelimit`.
    - Centralización del cliente Redis en `src/infrastructure/redis/RedisClient.ts`.

4.  **Application Layer (Casos de Uso)**
    - `ConfigService`: Lógica CRUD para configuraciones de caos.
    - `ChaosProxyService`: Orquestación principarl del proxy (rate limit, logging, decisión de caos).
    - `LogService`: Acceso a logs.

5.  **Interface Layer (API Walley)**
    - Refactorización de Controladores (`ConfigController`, `LogController`) para usar Inyección de Dependencias.
    - Definición de rutas en `src/api/routes`.

6.  **Dependency Injection**
    - Creación de container de dependencias en `src/container.ts` para wire-up de la aplicación.

7.  **Testing**
    - Actualización de tests de integración (`smoke.test.ts`, `ratelimit.test.ts`, `chaos.test.ts`, `websocket.test.ts`) para soportar la nueva arquitectura.

### 📝 Tareas Pendientes

1.  **Caching L1**: Implementar un cache en memoria (LRU) en `ChaosProxyService` para reducir la carga en Redis en entornos de tráfico extremo.
2.  **Autenticación Robusta**: Migrar de API Keys simples a JWT o OAuth2 si se requiere multi-tenancy real.
3.  **Structured Logging**: Implementar un logger estruturado (ej. Pino o Winston) en lugar de `console.log`.
4.  **Unit Tests para Servicios**: Aumentar la cobertura de tests unitarios específicos para la capa de servicios.
5.  **CI Pipeline**: Configurar un pipeline de CI completo (GitHub Actions) que corra tests y linter en cada PR.

---
