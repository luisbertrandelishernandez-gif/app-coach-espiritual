/**
 * drive-reader.js — Lector de carpetas Google Drive públicas
 * Usa Drive API v3 con API key pública (solo lectura)
 * Compartido por APP-001 Coach Espiritual y APP-002 Coach Psicológico
 */

// API key de Google Drive (lectura pública, restringida a *.github.io)
// Si no hay key configurada, se muestra mensaje de configuración
const API_KEY = localStorage.getItem('drive_api_key') || 'PENDIENTE_CONFIGURAR';

/**
 * Lista los archivos de una carpeta Drive pública
 * @param {string} folderId - ID de la carpeta Drive
 * @param {string} [mimeType] - Filtro MIME opcional (ej: 'audio/mpeg')
 * @param {number} [maxResults=50] - Máximo de resultados
 * @returns {Promise<Array>} Lista de archivos con id, name, mimeType, createdTime
 */
async function listFolderContents(folderId, mimeType, maxResults = 50) {
    let query = `'${folderId}' in parents and trashed=false`;
    if (mimeType) {
        query += ` and mimeType='${mimeType}'`;
    }

    const params = new URLSearchParams({
        q: query,
        key: API_KEY,
        fields: 'files(id,name,mimeType,createdTime,size)',
        orderBy: 'createdTime desc',
        pageSize: String(maxResults)
    });

    const url = `https://www.googleapis.com/drive/v3/files?${params}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            console.error('Error Drive API:', error.error?.message || response.statusText);
            return [];
        }
        const data = await response.json();
        return data.files || [];
    } catch (err) {
        console.error('Error de red al consultar Drive:', err);
        return [];
    }
}

/**
 * Obtiene la URL de descarga directa de un archivo Drive público
 * @param {string} fileId - ID del archivo
 * @returns {string} URL de descarga/stream
 */
function getDriveDownloadUrl(fileId) {
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
}

/**
 * Obtiene la URL de stream para audio (Google Drive)
 * @param {string} fileId - ID del archivo de audio
 * @returns {string} URL para el elemento <audio>
 */
function getDriveAudioUrl(fileId) {
    return getDriveDownloadUrl(fileId);
}

/**
 * Lee el contenido de texto de un archivo Drive público
 * @param {string} fileId - ID del archivo
 * @returns {Promise<string>} Contenido como texto
 */
async function readTextFile(fileId) {
    const url = getDriveDownloadUrl(fileId);
    try {
        const response = await fetch(url);
        if (!response.ok) return '';
        return await response.text();
    } catch (err) {
        console.error('Error leyendo archivo de texto:', err);
        return '';
    }
}

/**
 * Verifica que la API key está configurada
 * @returns {boolean}
 */
function isApiKeyConfigured() {
    return API_KEY !== 'PENDIENTE_CONFIGURAR' && API_KEY.length > 10;
}
