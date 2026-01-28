# AutoKanban

AutoKanban transforma tu archivo `Bitacora.md` en un tablero Kanban interactivo y visual. Diseñado para simplificar la gestión de proyectos personales o de equipo utilizando archivos Markdown como fuente de verdad.

## Características

- **Visualización Kanban**: Convierte listas de tareas Markdown en columnas (Pendiente, En Desarrollo, Completadas).
- **Integración GitHub**: Carga y sincroniza la bitácora directamente desde repositorios de GitHub.
- **Sin Base de Datos**: Tu archivo `Bitacora.md` es la base de datos.
- **Interfaz Moderna**: UI limpia con modo oscuro y soporte para drag-and-drop.

## Uso Rápido

### Pruebas del Parser

Para probar el parser de Markdown localmente:

```bash
npm test
# o manualmente:
node examples/runExample.js
```

### Interfaz Web

Para ver la interfaz web, simplemente abre `index.html` en tu navegador o sirve el directorio raíz:

```bash
npx serve .
```

## Estructura del Proyecto

- `Bitacora.md`: Archivo fuente de las tareas.
- `src/`: Lógica del parser (Core).
- `js/`: Lógica de la aplicación frontend.
- `api/`: Funciones Serverless (Vercel) que actúan como backend para leer/escribir en GitHub.
- `index.html`: Punto de entrada de la aplicación.

El archivo `Bitacora.md` se actualiza automáticamente al realizar cambios en el tablero (cuando la sincronización está activa).
