# FIX_APP001_DRIVE_AUTH — Corrección autenticación Drive API

**Fecha:** 2026-04-15
**App:** Coach Espiritual (APP-001)
**Rama:** autonomo/20260415-fix-drive-auth

## Problema

Las apps rechazaban la API key con el error:
```
API keys are not supported by this API. Expected OAuth2 access token or other authentication credentials.
```

## Causa raíz

Se encontraron dos problemas:

### 1. `testApiKeyEnVivo()` en `app.js` usaba un endpoint incompatible con API keys

El endpoint `/drive/v3/about?fields=user` **requiere OAuth2 obligatoriamente** porque devuelve datos del usuario autenticado. No acepta API keys bajo ninguna circunstancia.

Este era el error principal que provocaba el mensaje "API keys are not supported".

### 2. `listFolderContents()` en `drive-reader.js` no incluía parámetros para Shared Drives

Faltaban los parámetros `supportsAllDrives=true` e `includeItemsFromAllDrives=true` que son necesarios para acceder a carpetas públicas compartidas.

## Correcciones aplicadas

### `app.js`
- `testApiKeyEnVivo()`: Reemplazado endpoint `/about?fields=user` por `/files?pageSize=1&q='FOLDER_ID'+in+parents` que SÍ acepta API keys y sirve como test de conexión.

### `drive-reader.js`
- `listFolderContents()`: Agregados parámetros `supportsAllDrives: true` e `includeItemsFromAllDrives: true`.
- Agregado campo `webContentLink` a los fields solicitados.

## Endpoints válidos con API key (referencia)

| Endpoint | Acepta API key |
|---|---|
| `GET /drive/v3/files` (listar) | SI |
| `GET /drive/v3/files/{id}` (metadata) | SI |
| `GET /drive/v3/files/{id}?alt=media` (descargar) | SI |
| `GET /drive/v3/about` | NO (requiere OAuth2) |
| `GET /drive/v3/changes` | NO (requiere OAuth2) |
| `GET /drive/v3/permissions` | NO (requiere OAuth2) |

## Verificación

Probado con curl:
```bash
# FALLA - about requiere OAuth2:
curl "https://www.googleapis.com/drive/v3/about?fields=user&key=API_KEY"
# -> 401 "API keys are not supported by this API"

# FUNCIONA - files.list acepta API key:
curl "https://www.googleapis.com/drive/v3/files?q='FOLDER_ID'+in+parents&key=API_KEY&supportsAllDrives=true"
# -> 200 OK (o 400 si la key es inválida, pero no "not supported")
```
