# 🌪️ Chaos API Proxy (Titanium/Node Edition)

> **Un Web Proxy diseñado para introducir caos, latencia y fallos en tus APIs.**  
> Ahora reescrito en **TypeScript con Arquitectura Hexagonal** para máxima escalabilidad y robustez.

---

## 🚀 Características Principales

- **🛡️ Intercepción Transparente**: Proxy reverso de alto rendimiento.
- **🏗️ Arquitectura Hexagonal**: Código desacoplado, testearle y listo para escalar.
- **🔌 Soporte WebSocket**: Proxy transparente para conexiones `ws://` y `wss://`.
- **⏱️ Rate Limiting**: Redis-backed rate limiter distribuido.
- **⏱️ Inyección de Latencia**: Fija o con _jitter_ (variable).
- **💥 Inyección de Errores**: Retorna 500, 503, 404 a voluntad.
- **🧬 Response Fuzzing**: Muta JSONs para probar robustez de clientes.
- **📜 Dynamic Scripting**: Lógica JS personalizada para control granular.
- **📚 API Docs**: Swagger/OpenAPI en `/api-docs`.
- **📊 Métricas Prometheus**: Instrumentación nativa para observabilidad.

---

## 🛠️ Instalación y Uso

### Opción 1: Docker (Recomendado)

```bash
# 1. Clonar
git clone https://github.com/Medalcode/Chaos-API-Proxy.git
cd Chaos-API-Proxy

# 2. Arrancar (Redis + Proxy + Prometheus)
docker-compose up --build
```

El dashboard estará disponible en: [http://localhost:8081/dashboard](http://localhost:8081/dashboard)

### Opción 2: Local (Node.js)

Requisitos: Node.js 18+, Redis corriendo localmente.

```bash
# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env

# Correr Tests
npm test

# Arrancar en modo desarrollo
npm run dev

# Compilar y arrancar producción
npm run build
npm start
```

---

## 🏛️ Arquitectura

Este proyecto sigue una **Arquitectura Hexagonal (Clean Architecture)**:

- **Core (`src/core`)**: Contiene la lógica de dominio pura (Chaos Engine, Script Engine) y definiciones de tipos independientes de frameworks.
- **Application (`src/application`)**: Servicios que orquestan la lógica de negocio (`ChaosProxyService`, `ConfigService`).
- **Infrastructure (`src/infrastructure`)**: Implementaciones concretas (Redis Repositories, Rate Limiters).
- **API (`src/api`)**: Controladores REST y Rutas.
- **Container (`src/container.ts`)**: Inyección de dependencias centralizada.

Esta estructura permite escalar el proyecto, cambiar implementaciones (ej. cambiar Redis por Postgres) sin tocar la lógica de negocio, y facilita el testing unitario.

---

## 📜 Scripting Dinámico

Controla el caos programáticamente con JavaScript:

```javascript
/* Ejemplo: Latencia solo para usuarios móviles */
if (req.headers['user-agent'] && req.headers['user-agent'].includes('Mobile')) {
  decision.shouldLatency = true;
  decision.latencyMs = 1500;
}
```

---

_Hecho con ❤️ y ☕ por el equipo de Chaos Engineering._
