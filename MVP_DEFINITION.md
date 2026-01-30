# Definición de Estabilidad MVP - AutoKanban

**Fecha:** 2026-01-29
**Rol:** Tech Lead
**Estado:** V 1.0 Stable Candidate

Este documento define las condiciones bajo las cuales consideraremos que la versión actual de AutoKanban es "Estable" y lista para uso general como MVP (Minimum Viable Product).

## 1. Visión Técnica

AutoKanban ha evolucionado de una aplicación _full-stack serverless_ inestable a un **visualizador frontend robusto** (Viewer Pattern). Su responsabilidad única es renderizar estados; la complejidad de parseo y acceso a GitHub se ha delegado a la API externa estable **GitSpy**.

## 2. Criterios de Estabilidad (Definition of Done)

Para considerar el MVP "Terminado", el sistema debe cumplir estrictamente:

### A. Core Loop (Lectura)

- [x] **Carga Exitosa**: Capaz de cargar cualquier repositorio **público** que tenga un `Bitacora.md` válido.
- [x] **Navegación**: Capaz de cambiar entre repositorios (ej. de `Medalcode/AutoKanban` a `Medalcode/GitSpy`) sin recargar la página completa.
- [x] **URL Deep Linking**: Al compartir `?owner=X&repo=Y`, el receptor ve inmediatamente el tablero correcto.

### B. Resiliencia (Manejo de Errores)

- [x] **No "White Screens"**: Bajo ninguna circunstancia (JSON corrupto, red caída, 404, 500) la aplicación mostrará una pantalla en blanco. Siempre debe haber feedback visual.
- [x] **Degradación Elegante**: Si una tarea no tiene título o metadata inválida, se muestra con valores por defecto ("Untitled Task") y se loguea un `[AutoKanban Warn]`, pero **no rompe el tablero**.

### C. Experiencia de Usuario (UX)

- [x] **Estado Vacío**: Si `Bitacora.md` existe pero no tiene tareas, se muestra una guía de ayuda, no una tabla vacía confusa.
- [x] **Persistencia de Sesión**: Al cerrar y abrir la pestaña, el usuario vuelve al último proyecto visitado.

## 3. Riesgos Conocidos y Aceptados

Asumimos estos riesgos conscientemente para mantener la simplicidad del MVP:

1.  **Dependencia Crítica de GitSpy**:
    - _Riesgo_: Si `git-spy-tau.vercel.app` cae, AutoKanban deja de funcionar.
    - _Mitigación_: Pantalla de error clara ("Houston, tenemos un problema"). No hay fallback local complejo.
    - _Decisión_: Aceptable. Mantener lógica de backend duplicada en dos lugares (AutoKanban y GitSpy) probó ser inmanejable.

2.  **Conflictos de Edición (Sync)**:
    - _Riesgo_: Si dos personas editan el Kanban a la vez, el último commit gana o falla con 409 Conflict.
    - _Mitigación_: Se notifica el error 409. No hay interfaz visual de resolución de conflictos (Diff/Merge UI).
    - _Decisión_: Aceptable para MVP monousuario o equipos pequeños secuenciales.

3.  **Rate Limiting de GitHub**:
    - _Riesgo_: La API pública puede saturarse.
    - _Mitigación_: Manejo del error 403.
    - _Decisión_: Aceptable. La autenticación completa (OAuth) queda para v2.

## 4. Fuera de Alcance (Out of Scope) v1.0

Las siguientes funcionalidades están explícitamente **EXCLUIDAS** de este MVP para garantizar la entrega:

- ❌ **Soporte para Repos Privados**: Requiere flujo OAuth completo y gestión de secretos de usuario.
- ❌ **Edición de Markdown en crudo**: AutoKanban es una abstracción visual; no es un editor de texto.
- ❌ **Real-time (WebSockets)**: No habrá actualizaciones en tiempo real si otro usuario cambia algo; requiere recarga manual.
- ❌ **Personalización de Columnas**: Las columnas "Pendiente", "En Desarrollo", "Completadas" son fijas por contrato.

## 5. Conclusión Técnica

La arquitectura ha migrado de **"Monolito Serverless Inestable"** a **"Cliente Estático Resiliente"**.

Esta decisión reduce la superficie de errores de despliegue en un 90% (ya no hay builds de backend que fallen en AutoKanban) y centra el valor en la experiencia de usuario inmediata. El código actual en `js/` es el candidato final para la Release 1.0.
