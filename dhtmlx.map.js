/**
 * Factory that creates an OpenStreetMap inside a dhtmlXWindows modal.
 * The returned object IS an OpenStreetMap instance, extended with
 * getWindow() and showInstructions() for dhtmlx integration.
 *
 * @example
 * const dhtmlxMap = new DhtmlxMap();
 *
 * // Instructions via options (recommended)
 * const map = await dhtmlxMap.createMap("map", lat, lng, {
 *   title: "Select coordinates",
 *   instructions: "Click anywhere on the map to place a marker."
 * });
 *
 * // Or call showInstructions() separately
 * const map2 = await dhtmlxMap.createMap("map", lat, lng);
 * map2.showInstructions("Custom instructions here.");
 *
 * const win = map.getWindow();
 * win.progressOn();
 *
 * map.setupSearch().setupSelector((coords) => {
 *   win.progressOn();
 *   // ... update coordinates ...
 *   win.progressOff();
 *   win.close();
 * });
 */
class DhtmlxMap {

    /**
     * Creates a dhtmlx modal window, injects the map container HTML,
     * waits for the DOM to render, and then initializes OpenStreetMap.
     *
     * If lat/lng are provided the map centers on those coordinates with zoom 20;
     * otherwise it uses OpenStreetMap defaults.
     *
     * @param {string}  containerId            - ID for the map container element.
     * @param {number}  [lat]                  - Optional latitude to center on.
     * @param {number}  [lng]                  - Optional longitude to center on.
     * @param {Object}         [options]                      - Window/map options.
     * @param {string}         [options.title="Map"]          - Window title.
     * @param {number}         [options.zoom=20]              - Zoom level when coordinates are provided.
     * @param {string|boolean} [options.instructions=false]   - Instruction text to display, or false to hide.
     * @returns {Promise<OpenStreetMap>} The map instance, extended with getWindow() and showInstructions().
     */
    async createMap(containerId, lat, lng, options = {}) {
        const {
            title = "Map",
            zoom = 20,
            instructions = false,
        } = options;

        // ── Create dhtmlx modal window ──
        const dhxWins = new dhtmlXWindows();
        const win = dhxWins.createWindow("mapWindow", 10, 10, 370, 150);
        win.setText(title);
        win.setModal(true);
        win.maximize();
        win.center();
        win.showInnerScroll();

        // ── Build and attach HTML ──
        win.attachHTMLString(`
            <div class="map-container">
                <div class="map-view" id="${containerId}"></div>
            </div>
        `);

        // ── Wait for the DOM to render the container ──
        await new Promise(resolve => requestAnimationFrame(resolve));

        // ── Initialize OpenStreetMap (container is guaranteed in DOM) ──
        const map = new OpenStreetMap({ containerId });
        const hasCoordinates = lat != null && lng != null;

        if (hasCoordinates) {
            map.initMap({ lat, lng, zoom });
        } else {
            map.initMap();
        }

        // ── Extend the map instance with dhtmlx integration ──

        /**
         * Returns the dhtmlx window instance (progressOn, progressOff, close, setText, etc.).
         * @returns {object}
         */
        map.getWindow = () => win;

        /**
         * Displays an instruction banner above the map.
         * @param {string} [text="Click anywhere on the map to place a coordinate marker."]
         * @returns {OpenStreetMap} For chaining.
         */
        map.showInstructions = (text = "Click anywhere on the map to place a coordinate marker.") => {
            const container = document.getElementById(containerId)?.parentElement ?? document.getElementById(containerId);
            if (!container || container.querySelector(".map-instructions")) return map;

            const banner = document.createElement("div");
            banner.className = "map-instructions";
            banner.innerHTML = text;
            container.insertBefore(banner, container.firstChild);

            return map;
        };

        // ── Auto-show instructions if provided in options ──
        if (instructions) {
            map.showInstructions(instructions);
        }

        return map;
    }
}
