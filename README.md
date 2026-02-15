# 🗺️ Módulo de Mapas (Leaflet + OpenStreetMap)

> **Autor**: [@aceroraas](https://github.com/aceroraas)
>
> **Referencias**: [OpenStreetMap](https://www.openstreetmap.org/) | [LeafletJS](https://leafletjs.com/) | [DHTMLX](https://dhtmlx.com/)


Este directorio contiene un conjunto de herramientas y módulos desarrollados en **Vanilla JS** para la integración y gestión de mapas interactivos utilizando [Leaflet](https://leafletjs.com/) y proveedores de tiles como OpenStreetMap.

## 📦 Contenido del Directorio

El módulo es autosuficiente e incluye tanto la lógica de negocio como las dependencias necesarias:

*   **`openStreetMap.js`**: Clase principal (`OpenStreetMap`) que actual como wrapper sobre Leaflet. Facilita la inicialización, búsqueda de direcciones, selección de coordenadas, trazado de rutas (OSRM o directas) y manejo de marcadores.
*   **`dhtmlx.map.js`**: Wrapper especializado para integrar los mapas dentro de ventanas modales de [DHTMLX](https://dhtmlx.com/).
*   **`leaflet.js` / `leaflet.css`**: Librería núcleo de [Leaflet](https://leafletjs.com/).
*   **`Control.Geocoder.js` / `Control.Geocoder.css`**: Plugin para la búsqueda de direcciones y geocodificación.

---

## 🚀 Instalación e Integración

Este módulo está diseñado para ser flexible y agnóstico al entorno de carga. Funciona correctamente siempre que la clase global `L` de Leaflet esté disponible.

### 1. Requerimientos
Dado que es **Vanilla JS**, debes asegurarte de incluir los scripts y estilos en tu HTML.

### 2. Formas de Uso
Puedes cargar la libreria de tres formas:

*   **Archivos Locales (Recomendado)**: Usa los archivos `leaflet.js` y `Control.Geocoder.js` incluidos en este directorio.
*   **CDN**: Puedes vincular directamente a los CDNs de Leaflet.
*   **Cualquier Generador de `L`**: Si tu proyecto ya utiliza otra librería o bundler que expone la clase `L` en el objeto global `window`, este módulo funcionará automáticamente.

### Ejemplo de Inclusión en HTML

```html
<!-- Estilos -->
<link rel="stylesheet" href="app/js/maps/leaflet.css" />
<link rel="stylesheet" href="app/js/maps/Control.Geocoder.css" />

<!-- Scripts -->
<script src="app/js/maps/leaflet.js"></script>
<script src="app/js/maps/Control.Geocoder.js"></script>
<script src="app/js/maps/openStreetMap.js"></script>
<!-- Opcional: Solo si usas DHTMLX -->
<script src="app/js/maps/dhtmlx.map.js"></script>
```

---

## 🛠️ Uso de `OpenStreetMap`

La clase `OpenStreetMap` es la interfaz principal para interactuar con el mapa.

```javascript
/* Inicializar un mapa en el div con id "mi-mapa" */
const map = new OpenStreetMap({ 
    containerId: 'mi-mapa',
    lat: 10.4806, 
    lng: -66.9036,
    zoom: 13 
});

/* Configurar funcionalidades */
map.initMap()
   .setupSearch({ placeholder: 'Buscar dirección...' }) // Barra de búsqueda
   .setupSelector((coords) => {
       console.log('Coordenadas seleccionadas:', coords);
   });

/* Agregar un marcador */
map.addMarker(10.4806, -66.9036, '🏢', '<b>Oficina Central</b>');
```

---

## 🖼️ Integración con DHTMLX (`DhtmlxMap`)

> **Nota sobre Compatibilidad**: Este wrapper (`DhtmlxMap`) está diseñado para dar soporte a versiones antiguas y nuevas de componentes DHTMLX (v4 y v5+). Se encarga de manejar el ciclo de vida de la ventana modal y el renderizado del DOM.

La clase `DhtmlxMap` permite levantar un mapa dentro de una ventana de `dhtmlXWindows` de forma asíncrona.

```javascript
const dhtmlxMap = new DhtmlxMap();

// Crea ventana, espera al DOM e inicializa el mapa
const mapInstance = await dhtmlxMap.createMap("id_contenedor_temporal", latitude, longitude, {
    title: "Seleccionar Ubicación",
    instructions: "Haga clic en el mapa para marcar su posición"
});

// La instancia devuelta es un objeto OpenStreetMap extendido
const win = mapInstance.getWindow(); // Acceso a la ventana DHTMLX

// Configurar selector
mapInstance.setupSelector((coords) => {
    console.log("Guardando...", coords);
    win.close();
});
```

