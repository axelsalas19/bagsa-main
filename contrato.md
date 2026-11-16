# CONTRATO TÉCNICO Y FUENTE DE LA VERDAD — GEOPORTAL BAGSA
**Proyecto:** Geoportal Buenos Aires Gas S.A. (`bagsa-main`)  
**Fecha de creación:** 16 de Noviembre de 2026  
**Propósito:** Este documento actúa como la **Fuente Única de la Verdad (Single Source of Truth - SSOT)** del proyecto. Define los objetivos, la arquitectura modular, el funcionamiento general de cada componente, las herramientas implementadas (medición, indicadores, ruteo, seguridad) y establece el registro auditable de commits y cambios en el código.

---

## 1. Objetivos del Proyecto

### 1.1 Objetivo General
Proveer a Buenos Aires Gas S.A. (BAGSA) de una plataforma geoespacial web (Geoportal) centralizada, ágil y segura para la visualización, gestión, análisis espacial y administración operativa de la infraestructura de distribución de gas, parcelas catastrales, redes y suministros en los diferentes municipios y áreas de servicio de la Provincia de Buenos Aires.

### 1.2 Objetivos Específicos
1. **Visualización Geoespacial Integral:** Integrar en un entorno unificado capas vectoriales y ráster: Municipios, Áreas de Servicio (Localidades), Red de Gas (con discriminación por diámetros), Calles, Parcelas (vía WMS/WFS de ARBA) y Suministros (medidores).
2. **Gestión Logística y Operativa de Ruteo:** Permitir la visualización, asignación, reordenamiento secuencial y optimización de rutas de toma de estado/lectura de medidores por parte del personal operativo.
3. **Control de Acceso y Seguridad de Datos (RLS + Auth):** 
   - Permitir la lectura pública del mapa para auditoría y consulta sin requerir login.
   - Restringir las operaciones de modificación de datos sensibles (estado del contrato, ruta, orden de lectura) exclusivamente a operadores autenticados mediante Supabase Auth y Row Level Security (RLS) en la base de datos PostgreSQL.
4. **Herramientas de Análisis en Tiempo Real:** Proveer paneles de indicadores clave de rendimiento (KPIs), métricas estadísticas y herramientas interactivas de medición de distancias y superficies en mapa.
5. **Autonomía y Ligereza:** Construir una arquitectura sin dependencias pesadas de compilación o frameworks monolíticos, permitiendo ejecución nativa en navegadores modernos y despliegues estáticos continuos (ej. GitHub Pages).

---

## 2. Arquitectura Tecnológica General

### 2.1 Stack Técnico
- **Frontend Core:** HTML5 semántico, CSS3 moderno (con variables CSS y diseño responsive para escritorio y móviles), JavaScript nativo (ECMAScript 6+ Modules).
- **Librería Cartográfica:** [Leaflet.js v1.9.4](https://leafletjs.com/) (CDN oficial).
- **Backend como Servicio (BaaS) / Base de Datos:** [Supabase](https://supabase.com/) con motor PostgreSQL y extensiones espaciales (PostGIS).
- **Parser de Geometrías:** [Wicket.js v1.3.8](https://github.com/arthur-e/Wicket) para transformar geometrías Well-Known Text (WKT) provenientes de la base de datos a formato GeoJSON consumible por Leaflet.
- **Servicios IDE / WMS Externos:** Geoserver de ARBA (Agencia de Recaudación Provincia de Buenos Aires) para consumo de la capa catastral de parcelas (`idera:Parcela`).
- **Capas Base Cartográficas:**
  - ArgenMap (Instituto Geográfico Nacional - IGN Argentina).
  - OpenStreetMap (OSM).
  - Esri World Imagery (Satélite).
  - Google Hybrid (Satélite con etiquetas de calles).
  - ArgenMap Gris (IGN).
- **CI/CD & Despliegue:** GitHub Actions (`static.yml` y `jekyll-gh-pages.yml`) para publicación directa en GitHub Pages.

---

## 3. Estructura del Repositorio y Módulos

```
bagsa-main/
├── .github/
│   └── workflows/
│       ├── jekyll-gh-pages.yml   # Workflow de despliegue mediante Jekyll
│       └── static.yml            # Workflow de despliegue como sitio estático
├── js/
│   ├── app.js                    # Orquestador general y ciclo de inicialización
│   ├── auth.js                   # Módulo de autenticación (Supabase Auth)
│   ├── config.js                 # Constantes de configuración, URLs y claves públicas
│   ├── db.js                     # Conector y ejecutor de consultas SQL / RPCs a Supabase
│   ├── export.js                 # Módulo de exportación de datos a formato CSV
│   ├── filters.js                # Lógica de cascada de filtros y selectores UI
│   ├── kpis.js                   # Módulo de indicadores estadísticos y gráficos SVG
│   ├── map.js                    # Inicialización de Leaflet, capas base y estilos
│   ├── measure.js                # Herramienta de medición de distancias y áreas en mapa
│   ├── popups.js                 # Constructores de popups interactivos y formularios
│   ├── routing.js                # Módulo de ruteo, secuencias y ordenamiento
│   ├── search.js                 # Buscador de suministros, rutas y calles con autocomplete
│   ├── state.js                  # Almacén central de estado reactivo global
│   └── utils.js                  # Utilidades auxiliares (WKT, BBox, notificaciones, colores)
├── supabase/
│   └── rls_policies.sql          # Script SQL idempotente de seguridad RLS y permisos
├── index.html                    # Estructura principal de la interfaz de usuario
├── logo.jpeg                     # Logotipo institucional de BAGSA
├── README.md                     # Documentación de puesta en marcha rápida
├── script.js                     # Entry point que importa e invoca app.js
├── style.css                     # Hojas de estilo unificadas del Geoportal
└── contrato.md                   # ESTE DOCUMENTO: Fuente de la verdad y tracking de commits
```

---

## 4. Detalle Funcional de los Módulos del Sistema

### 4.1 Orquestación y Estado (`js/app.js`, `js/state.js`, `script.js`)
- `state.js`: Define un objeto singleton global `state` que almacena: cliente Supabase, usuario logueado, colecciones en caché (`municipiosData`, `localidadesData`, `suministrosData`, etc.), referencias a los `L.layerGroup`, estado de filtros activos, flags del módulo de ruteo y variables de las herramientas de medición.
- `app.js`: Inicializa la conexión con Supabase configurando `persistSession: false` (sesión efímera de seguridad), enlaza la autenticación, construye el mapa con sus capas base, activa los escuchadores del DOM y conecta los eventos de cambio de sesión para actualizar popups abiertos y paneles reactivos sin recargar la página.

### 4.2 Autenticación y Seguridad (`js/auth.js`, `supabase/rls_policies.sql`)
- **Sesión Efímera:** Para evitar accesos indebidos en terminales compartidas, la sesión no se almacena en `localStorage` (`persistSession: false`). Al cerrar o recargar el navegador, la sesión expira automáticamente.
- **Doble Nivel de Seguridad:**
  1. *Frontend:* Los controles de edición de estado, asignación de ruta y orden permanecen deshabilitados u ocultos para usuarios no autenticados (`state.user === null`).
  2. *Backend (PostgreSQL RLS):* `rls_policies.sql` establece políticas donde `SELECT` es público para todos (`anon` y `authenticated`), mientras que `INSERT` y `UPDATE` en la tabla `suministros` están permitidos estrictamente al rol `authenticated`.
- **Protección de Datos Personales en Frontend:** En el popup de suministros (`js/popups.js`), el nombre/titular del cliente (`properties.cliente`) se mantiene oculto para usuarios públicos (`!state.user`), mostrándose únicamente cuando existe una sesión autenticada activa (`state.user`). El número de cliente (`properties.numero_cliente`) y número de medidor permanecen visibles públicamente como identificadores técnicos operativos.
- **Compatibilidad con Vistas y RPC:** Las vistas como `v_suministros_activos` se configuran con `security_invoker = false` y las funciones RPC (`get_streets_by_localidad`, `get_gas_network_by_localidad`, `get_parcelas_by_localidad`) se configuran como `SECURITY DEFINER` para permitir el consumo de geometrías sin colisionar con el RLS de las tablas base.

### 4.3 Consultas a Base de Datos y Servicios WFS/WMS (`js/db.js`)
- `loadBaseData()`: Descarga inicial con límites controlados para optimizar el rendimiento inicial: municipios (hasta 200), localidades/áreas de servicio (hasta 500) y suministros activos desde la vista `v_suministros_activos` (hasta 10.000 registros).
- Carga bajo demanda mediante RPCs parametrizadas por `id_localidad` o polígonos BBox para redes de gas, calles y parcelas.
- Conexión WMS/WFS de ARBA para visualizar el parcelario catastral oficial de la Provincia de Buenos Aires.
- Persistencia de cambios: métodos `actualizarSuministroDB` y `guardarCambiosRuteo` para registrar actualizaciones de ruta, orden y estado contractual con manejo transaccional en Supabase.

### 4.4 Filtros en Cascada (`js/filters.js`)
- **Nivel 1:** Filtro por Unidad Regional (UR). Lista las áreas de servicio asociadas y ajusta el mapa a su extensión.
- **Nivel 2:** Filtro por Área de Servicio / Localidad. Dispara la carga de las capas secundarias dependientes (Red de gas, Calles, Parcelas y Suministros locales).
- **Nivel 3:** Filtro por Producto (Gas Natural / GLP) y Turno.
- Soporte para deseleccionar y limpiar capas y restaurar el mapa al estado general sin pérdidas de datos en caché.

### 4.5 Búsquedas y Navegación (`js/search.js`)
- **Búsqueda de Suministros:** Por Nombre de titular, Número de Medidor o Código de Cliente. Localiza el punto en el mapa, hace zoom centrado y abre el popup de atributos.
- **Búsqueda por Ruta y Orden:** Permite ubicar suministros específicos filtrando por su índice de recorrido logístico.
- **Búsqueda de Calles:** Input conectado a un `datalist` con autocompletado en base a las calles de la localidad seleccionada. Al seleccionar una calle, resalta la geometría en el mapa y encuadra la vista.

### 4.6 Gestión de Rutas y Ruteo Operativo (`js/routing.js`)
- Clasificación automática en: *Suministros con ruta y orden asignados* y *Suministros sin ruta*.
- Asignación manual o en lote: permite seleccionar un suministro en el mapa e integrarlo a una ruta indicando su orden.
- Reordenamiento automático: desplaza correlativamente los números de orden existentes para evitar colisiones (`desplazarOrdenEnBorrador`).
- Sistema de Borrador (`state.borrador`): los cambios se previsualizan visualmente con trazado de polilíneas conectando los medidores según su orden secuencial con códigos de color unificados (`RUTA_COLORES`).
- Confirmación controlada: botón de guardado en base de datos con feedback de confirmación y advertencias en caso de modificaciones no guardadas.

### 4.7 Exportación de Reportes (`js/export.js`)
- Generación de archivos CSV descargables directamente en el cliente (usando `Blob` y codificación UTF-8 con BOM `\uFEFF` para apertura nativa en Excel).
- **Reporte de Suministros:** Exporta medidor, cliente, nombre, dirección, estado, localidad, ruta y orden.
- **Reporte de Calles:** Exporta inventario de calles de la localidad activa con su código y denominación.

### 4.8 Popups y Presentación de Atributos (`js/popups.js`)
- **Diferenciación Pública vs Autenticada:** Los popups de suministros discriminan la información mostrada según `state.user`:
  - *Vista Pública (sin sesión):* Muestra Medidor, Cliente N°, Categoría, Dirección, Estado, y Ruta/Orden informativa. Oculta el nombre/titular del cliente (`properties.cliente`) y bloquea/oculta los selectores de cambio de estado y asignación de ruta/orden.
  - *Vista Autenticada (con sesión):* Revela el nombre/titular del cliente con botón de copiado rápido, habilita inputs para modificación de ruta y orden (`updateRutaOrden`), y formulario para cambiar estado del suministro (`updateEstado`).
- **Navegación de Clusters/Direcciones Múltiples:** Cuando existen múltiples medidores asociados al mismo punto geográfico (`properties._clusterSize > 1`), renderiza botones interactivos de paginación (*Anterior / Siguiente*).

---

## 5. Herramientas Agregadas Específicas

### 5.1 Herramienta de Medición (`js/measure.js`)
Módulo especializado para la toma de medidas de precisión directamente sobre la cartografía sin necesidad de software GIS de escritorio externo.

#### Características y Funcionamiento Técnico:
1. **Control en Mapa:** Integrado en Leaflet como control personalizado `L.Control` ubicado en la esquina inferior izquierda (`bottomleft`).
2. **Modos Disponibles:**
   - **Medir Distancia (📏):** Permite calcular distancias lineales acumuladas en trayectos multipunto. Utiliza el método geodésico `latlng.distanceTo(...)` provisto por Leaflet sobre la elipsoide terrestre. Muestra líneas continuas y un segmento guía discontinuo en tiempo real (`state.measureTempLine`).
   - **Medir Área y Perímetro (📐):** Permite trazar polígonos cerrados de al menos 3 vértices. Calcula el área proyectada sobre la superficie terrestre mediante la fórmula esférica de Gauss/Green implementada en `calcArea(points)`:
     $$\text{Área} = \frac{1}{2} R^2 \left| \sum_{i=0}^{n-1} (\lambda_{i+1} - \lambda_i) (\sin \phi_{i+1} + \sin \phi_i) \right|$$
     donde $R = 6.371.000\text{ m}$. Calcula a su vez el perímetro sumando la distancia de todos los segmentos cerrando en el primer vértice.
   - **Limpiar Mediciones (🗑️):** Remueve todas las capas de medición, marcadores de vértices, popups temporales y restablece los escuchadores de eventos.
3. **Experiencia de Usuario e Interactividad:**
   - Al activarse un modo, el cursor cambia a cruz (`crosshair`) y se desactiva temporalmente el zoom por doble clic (`doubleClickZoom.disable()`) para permitir el cierre de geometrías con doble clic.
   - Tooltip flotante informativo (`#measureTooltip`) que sigue o guía al operador con instrucciones dinámicas (*"Clic para agregar puntos. Doble clic para finalizar"* o el cómputo parcial en tiempo real).
   - Conversión inteligente de unidades:
     - Distancias: metros ($< 1.000\text{ m}$) o kilómetros ($\ge 1.000\text{ m}$).
     - Áreas: metros cuadrados ($< 10.000\text{ m}^2$), hectáreas ($10.000\text{ m}^2 \le \text{área} < 1.000.000\text{ m}^2$) o kilómetros cuadrados ($\ge 1.000.000\text{ m}^2$).
   - Popup final persistente con el desglose del resultado (`L.popup` con estilo `measure-result-popup`).

### 5.2 Herramienta de Indicadores y KPIs (`js/kpis.js`)
Módulo para el diagnóstico analítico y control de gestión del estado de los suministros y la cobertura de ruteo.

#### Características y Funcionamiento Técnico:
1. **Interfaz de Usuario:** Botón flotante accesible desde el lateral superior derecho (`#toggleIndicadoresBtn`) que abre un panel lateral deslizante (`#indicadoresPanel`).
2. **Reactividad por Contexto:** El módulo detecta automáticamente si el usuario está observando la totalidad de la base, una Unidad Regional particular o un Área de Servicio específica (`state.currentFilter`), recalculando al instante todas las cifras.
3. **Métricas Computadas:**
   - **Total de Suministros** en el ámbito actual.
   - **Distribución por Estado de Contrato:**
     - Activos / Conectados.
     - Suspendidos / Cortados.
     - En Baja / Anomalías.
     - Sin Estado Registrado.
   - **Cobertura de Ruteo:** Cantidad y porcentaje de suministros con ruta y orden asignados frente a suministros pendientes de asignar.
   - **Totales de Control:** Cantidad de Áreas de Servicio activas y Rutas de lectura únicas operativas.
4. **Visualizaciones Gráficas Nativas:**
   - **Gráfico Donut SVG Dinámico (`renderDonutSVG`):** Generado matemáticamente en SVG puro sin sobrecargar la aplicación con dependencias externas como Chart.js o D3. Traza arcos polares proporcionales a cada estado con su respectiva paleta cromática identificatoria.
   - **Barras de Cobertura y Top Áreas:** Barras de porcentaje para seguimiento de la completitud de asignación de rutas y ranking de las 8 localidades con mayor densidad de suministros.

### 5.3 Otras Herramientas Integradas
- **Copia Rápida de Coordenadas:** Clic derecho sobre cualquier punto del mapa dispara la lectura de latitud y longitud a 6 decimales, las copia al portapapeles del sistema operativo (`navigator.clipboard.writeText`) y muestra una confirmación visual instantánea.
- **Semáforo y Leyenda de Cañerías:** Clasificación visual de la red de gas por código de colores según el diámetro nominal de cañería ($\varnothing 50\text{ mm}$, $\varnothing 63\text{ mm}$, $\varnothing 90\text{ mm}$, $\varnothing 125\text{ mm}$, $\varnothing 180\text{ mm}$ y otros).

---

## 6. Historial de Commits y Trazabilidad del Código

Este registro audita cronológicamente la evolución del repositorio. Todo commit futuro debe ser incorporado a esta tabla.

| Commit | Fecha | Autor | Mensaje | Descripción del Cambio Técnico |
| :--- | :--- | :--- | :--- | :--- |
| `ce5a374` | 2026-08-13 13:08:45 -0300 | axelsalas19 | `cambios_ag_ide` | **Línea base del proyecto.** Estructuración de la arquitectura modular ES6 (`js/`), creación del `index.html`, estilos completos `style.css`, módulos de mapa, ruteo, filtros, búsqueda, KPIs, mediciones y workflow de GitHub Actions para despliegue estático. |
| `f60213c` | 2026-08-13 13:21:49 -0300 | axels | `Add GitHub Actions workflow for Jekyll deployment` | Incorporación del flujo de trabajo `.github/workflows/jekyll-gh-pages.yml` para soporte y automatización de despliegue en GitHub Pages vía Jekyll. |
| `2cf7021` | 2026-08-13 21:25:45 -0300 | axelsalas19 | `rls_autenticacion` | **Implementación de Seguridad RLS + Supabase Auth.** Creación de `js/auth.js`, formulario de acceso en barra lateral, script SQL de políticas RLS (`supabase/rls_policies.sql`) y condicionamiento de edición en popups y ruteo a usuarios autenticados. |
| `796b027` | 2026-08-13 21:26:37 -0300 | axelsalas19 | `Merge branch 'main' of https://github.com/axelsalas19/bagsa-main` | Sincronización e integración de ramas remotas de trabajo. |
| `1615023` | 2026-08-13 21:38:56 -0300 | axelsalas19 | `fix_auth` | Ajustes en las políticas de RLS SQL para mantener las vistas públicas sin invoker conflictivo y parametrización de persistencia efímera de sesión en Supabase. |
| `9a7a310` | 2026-08-14 00:39:57 -0300 | axelsalas19 | `auth_fix` | Refuerzo de la sesión efímera (`persistSession: false`), actualización reactiva en caliente de popups abiertos (`refrescarPopupAbierto`) y panel de ruteo ante eventos de login/logout sin recargar la página. |
| `Pendiente` | 2026-11-16 | - | `feat(security): ocultar nombre de cliente en popup público` | Modificación de `js/popups.js` para ocultar el campo `cliente` (nombre/titular) en el popup de suministros a usuarios sin sesión (`!state.user`), manteniendo visible el `numero_cliente` e información técnica. El dato se revela al iniciar sesión. Actualización de `contrato.md`. |

---

## 7. Protocolo de Mantenimiento y Reglas de Desarrollo

Para garantizar que `contrato.md` se mantenga efectivamente como la **Fuente de la Verdad**, rigen las siguientes reglas operativas obligatorias:

1. **Inmutabilidad de la Modularidad:** No unificar los archivos JavaScript en un único archivo monolítico. Cualquier nueva funcionalidad debe diseñarse como módulo ES6 independiente e importarse formalmente según corresponda.
2. **Principio de Mínimo Privilegio (RLS):** Cualquier nueva tabla o función que admita escritura debe protegerse con políticas RLS explícitas en Supabase. Nunca exponer la `service_role key` en el frontend (`js/config.js`).
3. **Actualización Obligatoria de `contrato.md`:** 
   - Todo cambio relevante en la lógica de negocio, arquitectura, parámetros de base de datos o agregado de nuevas herramientas debe documentarse en las secciones pertinentes de este archivo.
   - Cada commit realizado en el repositorio debe registrarse en la tabla de la Sección 6 indicando su hash corto, fecha, autor, mensaje y alcance técnico detallado.
4. **Política de Cero Suposiciones:** Ante discrepancias entre requerimientos operativos de BAGSA y la implementación técnica, se deberá consultar y consensuar con el responsable del proyecto antes de alterar la lógica existente.
