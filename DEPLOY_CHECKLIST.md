# Checklist de Verificación de Despliegue (Vercel)

Este documento guía la validación post-deploy para asegurar que **AutoKanban** se ha actualizado correctamente y no hay versiones "zombie" o cacheadas sirviendo código antiguo.

## 1. Verificación de Integridad ("Smoke Test")

### ✅ A. Verificar URL de Producción

Asegúrate de estar navegando en el dominio canónico y no en una URL de preview efímera.

- **Correcto:** `https://auto-kanban.vercel.app/`
- **Incorrecto/Preview:** `https://auto-kanban-git-main-medalcode.vercel.app/` (vía branch) o `https://auto-kanban-7s8d6f8.vercel.app/` (vía hash).

### ✅ B. Verificar Versión del Código (Browser DevTools)

Debemos confirmar que el navegador descargó el JS nuevo que apunta a la API pública de GitSpy.

1. Abre DevTools (`F12` o `Ctrl+Shift+I`).
2. Ve a la pestaña **Network** (Red).
3. Haz clic en el filtro **JS**.
4. Recarga la página (`Ctrl+Shift+R` para forzar recarga).
5. Busca el archivo `api.js` (o ábrelo con `Ctrl+P` en Sources).
6. **Check clave:** Busca la línea `export const BASE_API_URL =`.
   - Si ves `'https://git-spy-tau.vercel.app'`, ✅ **ÉXITO**: Tienes la versión nueva (Hotfix Prompt 10).
   - Si ves rutas relativas o código viejo, ❌ **FALLO**: Estás viendo una versión cacheada.

### ✅ C. Prueba de Flujo Crítico

1. Ingresa `Owner: Medalcode`, `Repo: AutoKanban`.
2. Click en **Load**.
3. **Check clave:**
   - ¿Aparece el loader?
   - ¿Se renderizan las columnas (aunque estén vacías)?
   - ¿La URL cambió a `?owner=Medalcode&repo=AutoKanban`?
   - **Consola:** No debe haber errores rojos de `fetch`. Las advertencias amarillas `[AutoKanban Warn]` son aceptables.

---

## 2. Detección de Dominios "Zombie" y Caché

Un dominio "zombie" ocurre cuando Vercel sirve una versión anterior debido a políticas de caché agresivas o cuando no se ha promovido el deployment a producción.

### Señales de Alerta

| Señal Visual                  | Causa Probable                                                     | Acción Correctiva                                          |
| :---------------------------- | :----------------------------------------------------------------- | :--------------------------------------------------------- |
| **Cambios de UI no aparecen** | Caché del navegador (Service Worker o Disk Cache).                 | Prueba en modo **Incógnito**. Si funciona, limpia caché.   |
| **Error 404 en `api.js`**     | Archivo renombrado o movido en build, pero HTML pide el viejo.     | **Redeploy** en Vercel Dashboard (Rebuild sin caché).      |
| **La API da 500 (Local)**     | El código sigue intentando usar `/api/repos/...` del mismo origen. | Verifica el paso **1.B**. El `api.js` **no** se actualizó. |

---

## 3. Análisis de Logs en Vercel

Si algo falla a nivel servidor (ej. el build del frontend), revisa:

### A. Build Logs (En Dashboard > Deployments)

Busca errores durante la fase de "Build":

- `Module not found`: Falta un archivo importado.
- `ESLint check failed`: Errores de sintaxis que abortan el deploy.
- **Check clave:** El status debe ser `Ready` (Verde), no `Error` (Rojo).

### B. Runtime Logs (Functions)

_Nota: Ahora que usamos la API externa, los logs de la función serverless de AutoKanban son menos relevantes, pero si todavía se llaman:_

- Ve a la pestaña **Logs**.
- Filtra por `Error` o `Exception`.
- Si ves `FUNCTION_INVOCATION_FAILED` en llamadas a `/api/...`, confirma que tu frontend YA NO debería estar llamando ahí. Si lo hace, es código viejo.

---

## 4. Matriz de Solución Rápida

| Síntoma                         | Diagnóstico                                | Solución                                                                   |
| :------------------------------ | :----------------------------------------- | :------------------------------------------------------------------------- |
| **Pantalla Blanca**             | Error de sintaxis JS crítico.              | Mira la Consola de DevTools. Probablemente un `import` fallido.            |
| **"Repositorio no encontrado"** | Error 404 real o API caída.                | Verifica que el repo existe y es **Público**.                              |
| **Carga infinita (Spinner)**    | Promesa nunca resuelta o error silenciado. | Revisa la pestaña Network. ¿El request a GitSpy quedó `pending` o falló?   |
| **Datos viejos en Kanban**      | LocalStorage persistente.                  | Click en botón **limpiar (basurero)** o `localStorage.clear()` en consola. |
