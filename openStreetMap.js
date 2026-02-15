/**
 * Clase wrapper sobre Leaflet para gestión de mapas OpenStreetMap.
 * Permite inicializar mapas, buscar ubicaciones, seleccionar coordenadas,
 * dibujar rutas (recta u OSRM), y colocar marcadores y círculos.
 *
 * @example
 * const map = new OpenStreetMap({ containerId: 'mi-mapa' });
 * map.initMap()
 *     .setupSearch()
 *     .setupSelector((coords) => console.log(coords))
 *     .addMarkers(clientes, { fitBounds: true });
 */
class OpenStreetMap {
    // ── Configuración por defecto ──────────────────────
    static DEFAULTS = {
        lat: 8.240773,
        lng: -65.546409,
        zoom: 7,
        containerId: 'map',
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap | Strix Technologies | aceroraas',
        selectorIcon: '📦',
    };

    static LINKS = {
        googleMaps: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
        openStreetMap: (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`,
    };

    static OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

    // ── Estado interno ─────────────────────────────────
    #map = null;
    #selectorMarker = null;
    #selectedCoords = null;
    #isSelectorEnabled = false;
    #onSelectCallback = null;
    #routeLayers = [];
    #markers = [];
    #circles = [];

    // ── Inicialización ─────────────────────────────────

    /**
     * Crea una nueva instancia de OpenStreetMap.
     * Las opciones se fusionan con OpenStreetMap.DEFAULTS.
     * @param {Object} options - Configuración personalizada.
     * @param {number}  [options.lat=8.240773]       - Latitud por defecto.
     * @param {number}  [options.lng=-65.546409]     - Longitud por defecto.
     * @param {number}  [options.zoom=7]             - Nivel de zoom inicial.
     * @param {string}  [options.containerId='map']  - ID del elemento HTML contenedor.
     * @param {string}  [options.tileUrl]            - URL del tile layer.
     * @param {string}  [options.attribution]        - Texto de atribución.
     * @param {string}  [options.selectorIcon='📦']  - Emoji/icon del selector.
     */
    constructor(options = {}) {
        this.config = { ...OpenStreetMap.DEFAULTS, ...options };
    }

    /**
     * Indica si el mapa ha sido inicializado.
     * @returns {boolean}
     */
    get isInitialized() {
        return this.#map !== null;
    }

    /**
     * Inicializa el mapa Leaflet en el contenedor especificado.
     * Los parámetros no proporcionados se toman de this.config.
     * @param {Object}  [params]              - Parámetros de inicialización.
     * @param {number}  [params.lat]           - Latitud central.
     * @param {number}  [params.lng]           - Longitud central.
     * @param {string}  [params.containerId]   - ID del contenedor HTML.
     * @param {number}  [params.zoom]          - Nivel de zoom.
     * @returns {this} Para encadenamiento.
     * @example
     * map.initMap({ lat: 10.48, lng: -66.90, zoom: 12 });
     */
    initMap({ lat, lng, containerId, zoom } = {}) {
        lat = parseFloat(lat) || this.config.lat;
        lng = parseFloat(lng) || this.config.lng;
        containerId = containerId || this.config.containerId;
        zoom = parseInt(zoom) || this.config.zoom;
        this.config.lat = lat;
        this.config.lng = lng;
        this.config.zoom = zoom;
        this.#map = L.map(containerId).setView([lat, lng], zoom);
        L.tileLayer(this.config.tileUrl, {
            attribution: this.config.attribution,
        }).addTo(this.#map);

        return this;
    }

    // ── Búsqueda ───────────────────────────────────────

    /**
     * Agrega un control de búsqueda (geocoder) al mapa.
     * Permite buscar ciudades/direcciones y centra el mapa en el resultado.
     * @param {Object}  [options]                - Opciones del geocoder.
     * @param {string}  [options.placeholder]     - Texto placeholder del input.
     * @param {string}  [options.errorMessage]    - Mensaje si no encuentra resultados.
     * @returns {this} Para encadenamiento.
     * @example
     * map.initMap().setupSearch({ placeholder: 'Buscar dirección...' });
     */
    setupSearch(options = {}) {
        if (!this.#requireMap()) return this;


        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: options.placeholder ?? 'Buscar ciudad',
            errorMessage: options.errorMessage ?? 'No se encontró la ciudad',
            showResultIcons: false,
            collapsed: false,
            expand: 'click',
            ...options,
        });

        geocoder.on('markgeocode', (e) => {  // arrow fn = `this` correcto
            const { bbox } = e.geocode;
            this.#map.fitBounds([
                [bbox.getSouth(), bbox.getWest()],
                [bbox.getNorth(), bbox.getEast()],
            ]);
        });

        geocoder.addTo(this.#map);
        return this;
    }

    // ── Selector de coordenadas ────────────────────────

    /**
     * Habilita la selección de coordenadas haciendo clic en el mapa.
     * Al hacer clic aparece un marcador con popup y botón de confirmar.
     * @param {Function} [onSelect] - Callback que recibe las coordenadas al confirmar.
     *   Se invoca con: { lat, lng, timestamp, formatted, googleMapsUrl, openStreetMapUrl }
     * @returns {this} Para encadenamiento.
     * @example
     * map.setupSelector((coords) => {
     *     console.log(`Seleccionado: ${coords.formatted}`);
     *     console.log(`Google Maps: ${coords.googleMapsUrl}`);
     * });
     */
    setupSelector(onSelect = () => { }) {
        if (!this.#requireMap()) return this;

        this.#isSelectorEnabled = true;
        this.#onSelectCallback = onSelect;

        this.#map.on('click', (e) => this.#handleMapClick(e));

        // Delegación de eventos: escuchar clics en el botón de confirmar
        this.#map.getContainer().addEventListener('click', (e) => {
            if (e.target.closest('.map-selector-confirm-btn')) {
                this.confirmSelection();
            }
        });

        // Colocar marcador por defecto cuando el mapa esté listo
        this.#map.whenReady(() => {
            this.placeSelector(this.config.lat, this.config.lng);
        });

        return this;
    }

    /**
     * Coloca o mueve el marcador del selector a una posición específica.
     * Reemplaza el marcador anterior si existe.
     * @param {number} lat  - Latitud del punto.
     * @param {number} lng  - Longitud del punto.
     * @param {string} [icon] - Emoji/icono para el marcador (usa config.selectorIcon por defecto).
     */
    placeSelector(lat, lng, icon) {
        if (!this.#requireSelector()) return;

        icon = icon ?? this.config.selectorIcon;
        this.clearSelector();

        this.#selectedCoords = { lat, lng };
        const popup = this.#buildSelectorPopup(lat, lng);
        this.#selectorMarker = this.addMarker(lat, lng, icon, popup);
    }

    /**
     * Elimina el marcador del selector y limpia las coordenadas seleccionadas.
     */
    clearSelector() {
        if (!this.#map || !this.#selectorMarker) return;

        this.#map.removeLayer(this.#selectorMarker);
        this.#selectorMarker = null;
        this.#selectedCoords = null;
    }

    /**
     * Obtiene las coordenadas actualmente seleccionadas.
     * @returns {Object|null} Objeto con lat, lng, timestamp, formatted, googleMapsUrl, openStreetMapUrl.
     *   Retorna null si no hay punto seleccionado.
     */
    getSelectedCoordinates() {
        if (!this.#selectedCoords) return null;

        const { lat, lng } = this.#selectedCoords;
        return {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            timestamp: new Date().toISOString(),
            formatted: `${lat}, ${lng}`,
            googleMapsUrl: OpenStreetMap.LINKS.googleMaps(lat, lng),
            openStreetMapUrl: OpenStreetMap.LINKS.openStreetMap(lat, lng),
        };
    }

    /**
     * Confirma la selección actual y ejecuta el callback registrado en setupSelector.
     * Muestra una alerta si no hay punto seleccionado.
     * @returns {Object|null} Las coordenadas confirmadas, o null si no hay selección.
     */
    confirmSelection() {
        const coords = this.getSelectedCoordinates();
        if (!coords) {
            alert('❌ Primero selecciona un punto en el mapa');
            return null;
        }
        this.#onSelectCallback?.(coords);
        return coords;
    }

    // ── Rutas ──────────────────────────────────────────

    /**
     * Dibuja una ruta entre dos puntos.
     * Por defecto dibuja línea recta (offline). Con useRoadRoute: true usa OSRM.
     * @param {Object} origin  - { lat, lng, icon: '🏠', popup: 'HTML o texto' }
     * @param {Object} destination - { lat, lng, icon: '📦', popup: 'HTML o texto' }
     * @param {Object} routeOptions - { useRoadRoute: false, color, weight, opacity, fitBounds, dashArray }
     * @returns {Promise<{distance, distanceKm, duration?, durationMin?, markers, polyline}>}
     */
    async drawRoute(origin, destination, routeOptions = {}) {
        if (!this.#requireMap()) return null;

        if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
            console.warn('OpenStreetMap: drawRoute requiere origin y destination con lat/lng.');
            return null;
        }

        const {
            useRoadRoute = false,
            color = '#2C6B94',
            weight = 5,
            opacity = 0.7,
            fitBounds = true,
            dashArray = null,
        } = routeOptions;

        const lineStyle = { color, weight, opacity };
        if (dashArray) lineStyle.dashArray = dashArray;

        // ── Marcadores (siempre se colocan) ──
        const originMarker = this.addMarker(
            origin.lat, origin.lng,
            origin.icon ?? '🏠',
            origin.popup ?? null
        );

        const destinationMarker = this.addMarker(
            destination.lat, destination.lng,
            destination.icon ?? '📦',
            destination.popup ?? null
        );

        let polyline, result;

        if (useRoadRoute) {
            // ── Ruta por carretera (OSRM) ──
            result = await this.#fetchRoadRoute(origin, destination, lineStyle);
            if (!result) {
                // Fallback a línea recta si OSRM falla
                console.warn('OpenStreetMap: OSRM falló, usando línea recta como fallback.');
                result = this.#buildStraightRoute(origin, destination, lineStyle);
            }
        } else {
            // ── Línea recta (offline, por defecto) ──
            result = this.#buildStraightRoute(origin, destination, lineStyle);
        }

        polyline = result.polyline;

        // Guardar referencia para poder limpiar después
        this.#routeLayers.push({ polyline, originMarker, destinationMarker });

        // Ajustar vista para mostrar toda la ruta
        if (fitBounds) {
            this.#map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        }

        return {
            ...result.data,
            markers: { origin: originMarker, destination: destinationMarker },
            polyline,
        };
    }

    /**
     * Centra el mapa en las coordenadas especificadas.
     * @param {number} lat - Latitud.
     * @param {number} lng - Longitud.
     * @param {number} [zoom] - Nivel de zoom (opcional, preserva el actual si se omite).
     * @returns {this}
     */
    setView(lat, lng, zoom) {
        if (!this.#requireMap()) return this;
        this.#map.setView([lat, lng], zoom || this.#map.getZoom());
        return this;
    }


    #buildStraightRoute(origin, destination, lineStyle) {
        const coordinates = [
            [parseFloat(origin.lat), parseFloat(origin.lng)],
            [parseFloat(destination.lat), parseFloat(destination.lng)],
        ];

        // Si no se especificó dashArray, usar punteado por defecto para línea recta
        if (!lineStyle.dashArray) lineStyle.dashArray = '10, 8';

        const polyline = L.polyline(coordinates, lineStyle).addTo(this.#map);
        const distance = OpenStreetMap.#haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);

        return {
            polyline,
            data: {
                distance,
                distanceKm: (distance / 1000).toFixed(2),
                duration: null,
                durationMin: null,
                type: 'straight',
            },
        };
    }

    async #fetchRoadRoute(origin, destination, lineStyle) {
        const url = `${OpenStreetMap.OSRM_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.routes || data.routes.length === 0) {
                console.warn('OpenStreetMap: No se encontró una ruta entre los puntos.');
                return null;
            }

            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            const polyline = L.polyline(coordinates, lineStyle).addTo(this.#map);

            return {
                polyline,
                data: {
                    distance: route.distance,
                    distanceKm: (route.distance / 1000).toFixed(2),
                    duration: route.duration,
                    durationMin: (route.duration / 60).toFixed(1),
                    type: 'road',
                },
            };

        } catch (error) {
            console.error('OpenStreetMap: Error al calcular la ruta:', error);
            return null;
        }
    }

    /**
     * Distancia Haversine entre dos puntos (en metros).
     */
    static #haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // radio de la Tierra en metros
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Elimina todas las rutas dibujadas del mapa, incluyendo sus marcadores de origen y destino.
     */
    clearRoutes() {
        if (!this.#map) return;

        this.#routeLayers.forEach(({ polyline, originMarker, destinationMarker }) => {
            this.#map.removeLayer(polyline);
            if (originMarker) this.#map.removeLayer(originMarker);
            if (destinationMarker) this.#map.removeLayer(destinationMarker);
        });
        this.#routeLayers = [];
    }

    // ── Marcadores genéricos ───────────────────────────

    /**
     * Agrega un marcador individual al mapa con un emoji/icono personalizado.
     * @param {number} lat           - Latitud del marcador.
     * @param {number} lng           - Longitud del marcador.
     * @param {string} [icon='📦']   - Emoji o HTML para el icono del marcador.
     * @param {string} [popupContent] - Contenido HTML del popup (null = sin popup).
     * @returns {L.Marker|null} Instancia del marcador Leaflet, o null si el mapa no está inicializado.
     * @example
     * map.addMarker(10.48, -66.90, '🏠', '<b>Mi casa</b>');
     */
    addMarker(lat, lng, icon = '📦', popupContent = null) {
        if (!this.#requireMap()) return null;

        lat = lat ?? this.config.lat;
        lng = lng ?? this.config.lng;

        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: icon,
                className: 'map-custom-icon',
                iconSize: [30, 30],
                popupAnchor: [0, -30],
            }),
        }).addTo(this.#map);

        if (popupContent) {
            marker.bindPopup(popupContent).openPopup();
        }

        this.#markers.push(marker);
        return marker;
    }

    /**
     * Agrega múltiples marcadores al mapa desde un arreglo.
     * @param {Array} markers - [{ lat, lng, icon: '📦', popup: 'HTML o texto' }, ...]
     * @param {Object} options - { fitBounds: true }
     * @returns {Array} - arreglo de instancias de marcadores Leaflet
     */
    addMarkers(markers = [], options = {}) {
        if (!this.#requireMap()) return [];
        const { fitBounds = false } = options;

        const created = markers.map(({ lat, lng, icon, popup }) =>
            this.addMarker(lat, lng, icon ?? '📦', popup ?? null)
        ).filter(Boolean);

        if (fitBounds && created.length > 0) {
            const group = L.featureGroup(created);
            this.#map.fitBounds(group.getBounds(), { padding: [30, 30] });
        }

        return this;
    }

    /**
     * Elimina todos los marcadores genéricos (creados con addMarker/addMarkers).
     * @returns {this}
     */
    clearMarkers() {
        if (!this.#map) return this;

        this.#markers.forEach(marker => this.#map.removeLayer(marker));
        this.#markers = [];
        return this;
    }

    // ── Círculos (áreas/zonas) ─────────────────────────

    /**
     * Agrega un círculo al mapa.
     * @param {number} lat
     * @param {number} lng
     * @param {number} radius - radio en metros
     * @param {Object} options - { color, fillColor, fillOpacity, weight, popup }
     * @returns {L.Circle} - instancia del círculo Leaflet
     */
    addCircle(lat, lng, radius = 5000, options = {}) {
        if (!this.#requireMap()) return null;

        const {
            color = '#2C6B94',
            fillColor = '#2C6B94',
            fillOpacity = 0.15,
            weight = 2,
            popup = null,
        } = options;

        const circle = L.circle([lat, lng], {
            radius,
            color,
            fillColor,
            fillOpacity,
            weight,
        }).addTo(this.#map);

        if (popup) {
            circle.bindPopup(popup);
        }

        this.#circles.push(circle);
        return circle;
    }

    /**
     * Agrega múltiples círculos al mapa desde un arreglo.
     * @param {Array} circles - [{ lat, lng, radius, color, fillColor, fillOpacity, weight, popup }, ...]
     * @param {Object} options - { fitBounds: true }
     * @returns {this}
     */
    addCircles(circles = [], options = {}) {
        if (!this.#requireMap()) return this;
        const { fitBounds = false } = options;

        const created = circles.map(({ lat, lng, radius, ...opts }) =>
            this.addCircle(lat, lng, radius, opts)
        ).filter(Boolean);

        if (fitBounds && created.length > 0) {
            const group = L.featureGroup(created);
            this.#map.fitBounds(group.getBounds(), { padding: [30, 30] });
        }

        return this;
    }

    /**
     * Elimina todos los círculos del mapa.
     * @returns {this}
     */
    clearCircles() {
        if (!this.#map) return this;

        this.#circles.forEach(circle => this.#map.removeLayer(circle));
        this.#circles = [];
        return this;
    }

    // ── Métodos privados ───────────────────────────────

    /** Maneja el evento clic en el mapa para el selector de coordenadas. */
    #handleMapClick(e) {
        if (!this.#isSelectorEnabled) return;

        const lat = e.latlng.lat?.toFixed(8);
        const lng = e.latlng.lng?.toFixed(8);
        if (lat == null || lng == null) return;

        this.placeSelector(lat, lng);
    }

    /** Genera el HTML del popup para el selector de coordenadas. */
    #buildSelectorPopup(lat, lng) {
        return `
            <div class="map-selector-popup">
                <h3>🏁📦 Punto seleccionado</h3>
                <p>Latitud: ${lat}<br>Longitud: ${lng}</p>
                <a href="${OpenStreetMap.LINKS.googleMaps(lat, lng)}" 
                   target="_blank">🔗 Ver en Google Maps</a><br>
                <a href="${OpenStreetMap.LINKS.openStreetMap(lat, lng)}" 
                   target="_blank">🗺️ Ver en OpenStreetMap</a>
                <button class="map-selector-confirm-btn">
                    🏁 Seleccionar Coordenadas
                </button>
            </div>`;
    }

    /** Guard clause: verifica que el mapa esté inicializado. */
    #requireMap() {
        if (!this.#map) {
            console.warn('OpenStreetMap: El mapa no ha sido inicializado. Llama a initMap() primero.');
            return false;
        }
        return true;
    }

    /** Guard clause: verifica que el selector esté habilitado. */
    #requireSelector() {
        if (!this.#requireMap()) return false;
        if (!this.#isSelectorEnabled) {
            console.warn('OpenStreetMap: El selector no está habilitado. Llama a setupSelector() primero.');
            return false;
        }
        return true;
    }
}