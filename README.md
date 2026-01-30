# AutoKanban

> **v1.0 Stable** — _Tu Bitácora.md cobra vida._

AutoKanban es un visualizador avanzado que transforma archivos `Bitacora.md` alojados en GitHub en tableros Kanban interactivos. Adhiere al **Viewer Pattern**: actúa como un cliente estático resiliente que consume la API de [GitSpy](https://github.com/Medalcode/GitSpy) para procesar los datos.

![AutoKanban Preview](https://github.com/Medalcode/AutoKanban/raw/main/screenshot.png) <!-- (Si tienes una, si no, placeholder) -->

## ✨ Características (v1.0)

- **Zero Backend Local**: Arquitectura 100% estática. No hay servidores que configurar ni desplegar.
- **Markdown as DB**: Tu archivo `Bitacora.md` es la única fuente de verdad.
- **GitSpy Integration**: Utiliza la API pública estable de GitSpy para parsing inteligente y normalización de datos.
- **Resiliencia Total**: Manejo robusto de errores de red, datos corruptos y repositorios vacíos.
- **Smart UX**:
  - Persistencia de sesión (recuerda tu último repo).
  - URLs compartibles (`?owner=X&repo=Y`).
  - Estados vacíos amigables con snippets de código para empezar rápido.

## 🚀 Uso Inmediato

Visita la versión desplegada en Vercel:
**[https://auto-kanban.vercel.app](https://auto-kanban.vercel.app)**

1.  Ingresa el **Owner** (ej `Medalcode`).
2.  Ingresa el **Repo** (ej `AutoKanban`).
3.  ¡Listo! Tu tablero está vivo.

## 🏗️ Estructura del Proyecto

```text
/
├── js/
│   ├── app.js       # Controlador principal (Orquestador UI/Data)
│   ├── api.js       # Cliente HTTP (GitSpy API connection)
│   ├── model.js     # Normalización de datos y sanitización
│   ├── kanban.js    # Renderizado de componentes UI
│   ├── storage.js   # Persistencia local (LocalStorage)
│   └── sync.js      # Sincronización (Write) con GitHub
├── Bitacora.md      # Ejemplo de contrato de datos estándar
├── MVP_DEFINITION.md# Criterios de estabilidad v1.0
└── index.html       # Entry point
```

## 🛠️ Desarrollo Local

1.  Clonar:

    ```bash
    git clone https://github.com/Medalcode/AutoKanban.git
    cd AutoKanban
    ```

2.  Servir (cualquier servidor estático sirve):
    ```bash
    npx serve .
    ```

## 📝 Contrato de Datos (`Bitacora.md`)

Para que AutoKanban funcione óptimamente, tu archivo debe seguir este [formato estándar](Bitacora.md):

```markdown
## 📌 Meta

Project: Mi Proyecto
...

## 🧱 Features

### [TODO] tarea-1 — Mi primera tarea

- Description: ...
```

---

_Powered by [GitSpy](https://github.com/Medalcode/GitSpy)._
