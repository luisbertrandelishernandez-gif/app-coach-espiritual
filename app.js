/**
 * app.js — Coach Espiritual (APP-001)
 * Lógica principal: rotación semanal de ejes temáticos,
 * lectura de podcasts y meditaciones desde Drive público.
 *
 * Tareas C1 + C3:
 *   - Validación de formato de API key (AIzaSy + 39 chars)
 *   - Test en vivo contra Drive API /about?fields=user
 *   - Mensajes de ayuda accesibles (aria-live)
 *   - Accesibilidad WCAG AAA (ver style.css)
 */

// Carpeta Drive principal de podcasts coach espiritual
const FOLDER_PODCASTS = '1L9TjHoeuCiDr_tcKowLRaHmdIMKS8lwY';

// Rotación semanal de ejes temáticos (Lunes=1 ... Domingo=0)
const ROTACION_SEMANAL = {
    1: 'Humildad',
    2: 'Servicio',
    3: 'Fe y Oración',
    4: 'Presencia',
    5: 'Compasión',
    6: 'Gratitud',
    0: 'Trascendencia'
};

// Cuadernos NotebookLM asociados a cada eje
const CUADERNOS = [
    'Trascendencia', 'Servicio', 'Fe y Oración', 'Presencia',
    'Compasión', 'Gratitud', 'Humildad', 'Resiliencia'
];

/* ============================================================
   VALIDACIÓN Y GUARDADO DE API KEY
   ============================================================ */

/**
 * Valida el formato local de la API key de Google.
 * Debe empezar por "AIzaSy" y tener exactamente 39 caracteres.
 * @param {string} key
 * @returns {{ ok: boolean, mensaje: string }}
 */
function validarFormatoApiKey(key) {
    if (!key) {
        return { ok: false, mensaje: 'Introduce la API key para continuar.' };
    }
    if (!key.startsWith('AIzaSy')) {
        return { ok: false, mensaje: 'La key debe empezar por "AIzaSy".' };
    }
    if (key.length !== 39) {
        return {
            ok: false,
            mensaje: `Longitud incorrecta: tiene ${key.length} caracteres, debe tener 39.`
        };
    }
    return { ok: true, mensaje: '' };
}

/**
 * Hace una llamada mínima a Drive API para verificar que la key
 * es válida y la API está habilitada.
 * Endpoint: GET /drive/v3/about?fields=user&key=KEY
 * @param {string} key
 * @returns {Promise<{ ok: boolean, mensaje: string }>}
 */
async function testApiKeyEnVivo(key) {
    const url = `https://www.googleapis.com/drive/v3/about?fields=user&key=${encodeURIComponent(key)}`;
    try {
        const resp = await fetch(url);
        if (resp.ok) {
            const data = await resp.json();
            const email = data?.user?.emailAddress || '';
            return {
                ok: true,
                mensaje: email
                    ? `Conexión OK — cuenta: ${email}`
                    : 'Conexión a Drive API correcta.'
            };
        }
        // Error HTTP: leer el cuerpo para dar un mensaje útil
        let errMsg = `Error ${resp.status}`;
        try {
            const errData = await resp.json();
            const detalle = errData?.error?.message || '';
            if (resp.status === 400) {
                errMsg = 'Key inválida. Revisa que hayas copiado la key completa.';
            } else if (resp.status === 403) {
                if (detalle.toLowerCase().includes('not been used') || detalle.toLowerCase().includes('disabled')) {
                    errMsg = 'La API de Google Drive no está habilitada en tu proyecto de Google Cloud. Ve a console.cloud.google.com → Biblioteca → Drive API → Habilitar.';
                } else if (detalle.toLowerCase().includes('referer') || detalle.toLowerCase().includes('ip')) {
                    errMsg = 'La key está restringida por dominio/IP. Añade este dominio a las restricciones de la key en Google Cloud Console.';
                } else {
                    errMsg = `Acceso denegado: ${detalle || 'verifica los permisos de la key.'}`;
                }
            } else {
                errMsg = detalle || errMsg;
            }
        } catch (_) { /* ignorar si el cuerpo no es JSON */ }
        return { ok: false, mensaje: errMsg };
    } catch (err) {
        return {
            ok: false,
            mensaje: 'No se pudo conectar con Google. Verifica tu conexión a internet.'
        };
    }
}

/**
 * Reacciona mientras el usuario escribe en el campo de API key:
 * habilita/deshabilita el botón según el formato.
 */
function onInputApiKey() {
    const input    = document.getElementById('input-api-key');
    const icono    = document.getElementById('api-key-icono');
    const estado   = document.getElementById('api-key-estado');
    const btnGuard = document.getElementById('btn-guardar-key');
    const key      = input.value.trim();

    const { ok, mensaje } = validarFormatoApiKey(key);

    // Limpiar clases previas
    icono.className  = 'api-key-icono';
    estado.className = 'api-key-estado';
    estado.textContent = '';

    if (!key) {
        icono.textContent = '';
        btnGuard.disabled = true;
        return;
    }

    if (ok) {
        icono.textContent  = '✓';
        icono.classList.add('ok');
        btnGuard.disabled = false;
    } else {
        icono.textContent  = '✗';
        icono.classList.add('error');
        estado.textContent  = mensaje;
        estado.classList.add('error');
        btnGuard.disabled = true;
    }
}

/**
 * Al pulsar "Verificar y guardar": valida formato, prueba la API
 * y, si todo es correcto, guarda en localStorage y recarga.
 */
async function guardarApiKey() {
    const input    = document.getElementById('input-api-key');
    const icono    = document.getElementById('api-key-icono');
    const estado   = document.getElementById('api-key-estado');
    const btnGuard = document.getElementById('btn-guardar-key');
    const key      = input.value.trim();

    // 1. Validación de formato
    const { ok: fmtOk, mensaje: fmtMsg } = validarFormatoApiKey(key);
    if (!fmtOk) {
        mostrarEstadoKey(icono, estado, false, fmtMsg);
        return;
    }

    // 2. Test en vivo
    btnGuard.disabled  = true;
    btnGuard.textContent = 'Verificando…';
    estado.className  = 'api-key-estado';
    estado.textContent = 'Contactando con Google Drive API…';

    const { ok: apiOk, mensaje: apiMsg } = await testApiKeyEnVivo(key);

    btnGuard.textContent = 'Verificar y guardar';
    btnGuard.disabled  = false;

    if (!apiOk) {
        mostrarEstadoKey(icono, estado, false, apiMsg);
        return;
    }

    // 3. Todo OK: guardar y recargar
    mostrarEstadoKey(icono, estado, true, apiMsg + ' — guardando…');
    localStorage.setItem('drive_api_key', key);
    setTimeout(() => location.reload(), 900);
}

/**
 * Actualiza el icono y el texto de estado en el panel de configuración.
 * @param {HTMLElement} icono
 * @param {HTMLElement} estado
 * @param {boolean} ok
 * @param {string} mensaje
 */
function mostrarEstadoKey(icono, estado, ok, mensaje) {
    icono.className  = 'api-key-icono ' + (ok ? 'ok' : 'error');
    icono.textContent = ok ? '✓' : '✗';
    estado.className  = 'api-key-estado ' + (ok ? 'ok' : 'error');
    estado.textContent = mensaje;
}

/**
 * Muestra el panel de configuración de API key y conecta el listener de input.
 */
function mostrarConfigApiKey() {
    const panel = document.getElementById('config-api');
    panel.style.display = 'block';

    // Conectar listener de input en tiempo real
    const input = document.getElementById('input-api-key');
    input.removeEventListener('input', onInputApiKey);
    input.addEventListener('input', onInputApiKey);

    document.getElementById('contenido-hoy').innerHTML = `
        <div class="estado-vacio">
            <div class="icono">&#128273;</div>
            <p>Configura la API key de Google Drive para acceder al contenido.</p>
        </div>`;
}

/* ============================================================
   LÓGICA DE CONTENIDO
   ============================================================ */

/**
 * Obtiene el eje temático del día según la rotación semanal.
 */
function obtenerEjeDelDia(fecha = new Date()) {
    const dia = fecha.getDay();
    return ROTACION_SEMANAL[dia] || 'Trascendencia';
}

/**
 * Formatea una fecha completa para mostrar al usuario.
 */
function formatearFecha(dateStr) {
    const fecha = new Date(dateStr);
    return fecha.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

/**
 * Formatea fecha corta para el historial.
 */
function formatearFechaCorta(dateStr) {
    const fecha = new Date(dateStr);
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

/**
 * Filtra archivos por nombre que contenga el eje temático.
 */
function filtrarPorEje(archivos, eje) {
    const ejeNorm = eje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return archivos.filter(f => {
        const nombre = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nombre.includes(ejeNorm);
    });
}

/**
 * Clasifica archivos en podcasts (audio) y meditaciones (texto).
 */
function clasificarArchivos(archivos) {
    const podcasts = archivos.filter(f =>
        f.mimeType?.startsWith('audio/') || f.name.endsWith('.mp3') || f.name.endsWith('.wav')
    );
    const meditaciones = archivos.filter(f =>
        f.mimeType === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.md')
    );
    return { podcasts, meditaciones };
}

/**
 * Carga y muestra el contenido del día.
 */
async function cargarContenidoDelDia() {
    const contenedorHoy       = document.getElementById('contenido-hoy');
    const contenedorHistorial = document.getElementById('historial');

    if (!isApiKeyConfigured()) {
        mostrarConfigApiKey();
        return;
    }

    // Mostrar estado de carga
    contenedorHoy.innerHTML = '<div class="cargando"><div class="spinner" role="status" aria-label="Cargando contenido"></div><p>Cargando contenido...</p></div>';

    const ejeHoy = obtenerEjeDelDia();
    document.getElementById('eje-nombre').textContent = ejeHoy;
    document.getElementById('eje-fecha').textContent  = formatearFecha(new Date().toISOString());

    try {
        const archivos = await listFolderContents(FOLDER_PODCASTS);

        if (archivos.length === 0) {
            contenedorHoy.innerHTML = `
                <div class="estado-vacio">
                    <div class="icono">&#128247;</div>
                    <p>No hay contenido disponible en la carpeta Drive.</p>
                    <p>Verifica que la carpeta sea pública y contenga archivos.</p>
                </div>`;
            return;
        }

        const delEje = filtrarPorEje(archivos, ejeHoy);
        const { podcasts, meditaciones } = clasificarArchivos(delEje.length > 0 ? delEje : archivos);

        let htmlHoy = '';

        if (podcasts.length > 0) {
            const podcast = podcasts[0];
            htmlHoy += `
                <div class="reproductor">
                    <h3>Podcast del día — ${ejeHoy}</h3>
                    <p class="titulo-audio">${podcast.name}</p>
                    <audio controls preload="none">
                        <source src="${getDriveAudioUrl(podcast.id)}" type="audio/mpeg">
                        Tu navegador no soporta el elemento audio.
                    </audio>
                </div>`;
        } else {
            htmlHoy += `
                <div class="estado-vacio">
                    <p>No hay podcast disponible para el eje "${ejeHoy}" hoy.</p>
                </div>`;
        }

        if (meditaciones.length > 0) {
            const med   = meditaciones[0];
            const texto = await readTextFile(med.id);
            htmlHoy += `
                <div>
                    <h3>Meditación del día</h3>
                    <div class="visor-texto">${texto || 'Cargando meditación...'}</div>
                </div>`;
        }

        contenedorHoy.innerHTML = htmlHoy;

        // Historial (últimos 7 podcasts)
        const todosAudios = clasificarArchivos(archivos).podcasts.slice(0, 7);
        if (todosAudios.length > 0) {
            let htmlHistorial = '';
            todosAudios.forEach(audio => {
                htmlHistorial += `
                    <div class="historial-item">
                        <span class="historial-fecha">${formatearFechaCorta(audio.createdTime)}</span>
                        <span class="historial-titulo">${audio.name}</span>
                        <button class="historial-play" onclick="reproducir('${audio.id}')" aria-label="Reproducir ${audio.name}">&#9654;</button>
                    </div>`;
            });
            contenedorHistorial.innerHTML = htmlHistorial;
        } else {
            contenedorHistorial.innerHTML = '<p class="estado-vacio">Sin historial disponible</p>';
        }

    } catch (err) {
        console.error('Error cargando contenido:', err);
        contenedorHoy.innerHTML = `
            <div class="estado-vacio">
                <div class="icono">&#9888;</div>
                <p>Error al cargar el contenido. Verifica tu conexión.</p>
            </div>`;
    }
}

/**
 * Reproduce un audio del historial en un reproductor flotante.
 */
function reproducir(fileId) {
    const audioUrl = getDriveAudioUrl(fileId);
    let player = document.getElementById('reproductor-flotante');
    if (!player) {
        player = document.createElement('audio');
        player.id       = 'reproductor-flotante';
        player.controls = true;
        player.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);width:90%;max-width:600px;z-index:100;';
        document.body.appendChild(player);
    }
    player.src = audioUrl;
    player.play();
}

// Iniciar al cargar la página
document.addEventListener('DOMContentLoaded', cargarContenidoDelDia);
