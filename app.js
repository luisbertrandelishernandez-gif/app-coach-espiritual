/**
 * app.js — Coach Espiritual (APP-001)
 * Lógica principal: rotación semanal de ejes temáticos,
 * lectura de podcasts y meditaciones desde Drive público
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
    0: 'Trascendencia'  // Domingo
};

// Cuadernos NotebookLM asociados a cada eje
const CUADERNOS = [
    'Trascendencia', 'Servicio', 'Fe y Oración', 'Presencia',
    'Compasión', 'Gratitud', 'Humildad', 'Resiliencia'
];

/**
 * Obtiene el eje temático del día según la rotación semanal
 */
function obtenerEjeDelDia(fecha = new Date()) {
    const dia = fecha.getDay(); // 0=dom, 1=lun, ...
    return ROTACION_SEMANAL[dia] || 'Trascendencia';
}

/**
 * Formatea una fecha para mostrar al usuario
 */
function formatearFecha(dateStr) {
    const fecha = new Date(dateStr);
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    return fecha.toLocaleDateString('es-ES', opciones);
}

/**
 * Formatea fecha corta para historial
 */
function formatearFechaCorta(dateStr) {
    const fecha = new Date(dateStr);
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

/**
 * Filtra archivos por nombre que contenga el eje temático
 */
function filtrarPorEje(archivos, eje) {
    const ejeNorm = eje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return archivos.filter(f => {
        const nombre = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nombre.includes(ejeNorm);
    });
}

/**
 * Clasifica archivos en podcasts (audio) y meditaciones (texto)
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
 * Carga y muestra el contenido del día
 */
async function cargarContenidoDelDia() {
    const contenedorHoy = document.getElementById('contenido-hoy');
    const contenedorHistorial = document.getElementById('historial');

    if (!isApiKeyConfigured()) {
        mostrarConfigApiKey();
        return;
    }

    // Mostrar estado de carga
    contenedorHoy.innerHTML = '<div class="cargando"><div class="spinner"></div><p>Cargando contenido...</p></div>';

    const ejeHoy = obtenerEjeDelDia();
    document.getElementById('eje-nombre').textContent = ejeHoy;
    document.getElementById('eje-fecha').textContent = formatearFecha(new Date().toISOString());

    try {
        // Obtener todos los archivos de la carpeta
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

        // Filtrar contenido del eje de hoy
        const delEje = filtrarPorEje(archivos, ejeHoy);
        const { podcasts, meditaciones } = clasificarArchivos(delEje.length > 0 ? delEje : archivos);

        // Renderizar contenido del día
        let htmlHoy = '';

        if (podcasts.length > 0) {
            const podcast = podcasts[0]; // El más reciente
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
            const med = meditaciones[0];
            const texto = await readTextFile(med.id);
            htmlHoy += `
                <div>
                    <h3>Meditación del día</h3>
                    <div class="visor-texto">${texto || 'Cargando meditación...'}</div>
                </div>`;
        }

        contenedorHoy.innerHTML = htmlHoy;

        // Renderizar historial (últimos 7 podcasts)
        const todosAudios = clasificarArchivos(archivos).podcasts.slice(0, 7);
        if (todosAudios.length > 0) {
            let htmlHistorial = '';
            todosAudios.forEach(audio => {
                htmlHistorial += `
                    <div class="historial-item">
                        <span class="historial-fecha">${formatearFechaCorta(audio.createdTime)}</span>
                        <span class="historial-titulo">${audio.name}</span>
                        <button class="historial-play" onclick="reproducir('${audio.id}')" title="Reproducir">&#9654;</button>
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
 * Reproduce un audio del historial
 */
function reproducir(fileId) {
    const audioUrl = getDriveAudioUrl(fileId);
    // Buscar o crear el reproductor flotante
    let player = document.getElementById('reproductor-flotante');
    if (!player) {
        player = document.createElement('audio');
        player.id = 'reproductor-flotante';
        player.controls = true;
        player.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);width:90%;max-width:600px;z-index:100;';
        document.body.appendChild(player);
    }
    player.src = audioUrl;
    player.play();
}

/**
 * Muestra el panel de configuración de API key
 */
function mostrarConfigApiKey() {
    document.getElementById('config-api').style.display = 'block';
    document.getElementById('contenido-hoy').innerHTML = `
        <div class="estado-vacio">
            <div class="icono">&#128273;</div>
            <p>Configura la API key de Google Drive para acceder al contenido.</p>
        </div>`;
}

/**
 * Guarda la API key en localStorage
 */
function guardarApiKey() {
    const input = document.getElementById('input-api-key');
    const key = input.value.trim();
    if (key.length > 10) {
        localStorage.setItem('drive_api_key', key);
        location.reload();
    }
}

// Iniciar al cargar la página
document.addEventListener('DOMContentLoaded', cargarContenidoDelDia);
