# bagsa

Geoportal para Buenos Aires Gas S.A. conectado a Supabase.

## Seguridad (RLS + Autenticación)

El geoportal usa RLS en todas las tablas/vistas y Supabase Auth para
proteger las operaciones de escritura (cambiar estado, ruta u orden de un
suministro). Las lecturas del mapa siguen siendo públicas.

### 1) Activar RLS en la base de datos

Ejecutar el script completo en **Supabase Dashboard → SQL Editor → New query**:

- `supabase/rls_policies.sql`

Esto hace lo siguiente:

- Habilita `ROW LEVEL SECURITY` solo en las **tablas reales**: `municipios`,
  `localidades`, `suministros`, `parcelas`, `calles`, `red_de_gas`.
- Las **vistas no se modifican**: `v_suministros_activos` y las demás vistas
  conservan su comportamiento original (lectura por el owner sin RLS), por lo
  que la carga de datos del mapa sigue funcionando igual.
- Política **SELECT público** (`anon` + `authenticated`) en las tablas → el mapa
  sigue cargando sin login.
- Política **UPDATE/INSERT solo para `authenticated`** en `suministros` → solo
  usuarios con sesión pueden editar estado/ruta/orden.
- Otorga `SELECT`/`EXECUTE` a `anon` y `authenticated` y deja las funciones RPC
  (`get_streets_by_localidad`, `get_gas_network_by_localidad`,
  `get_parcelas_by_localidad`) como `SECURITY DEFINER` para que sigan
  devolviendo geometrías con RLS activo.

> Nota: el script es idempotente; puede ejecutarse más de una vez sin error.

### 2) Crear usuarios

- Supabase Dashboard → **Authentication → Users → Add user** (o invitar por email).
- También es posible el registro desde el formulario del geoportal si se pone
  `SUPABASE_ALLOW_SIGNUP = true` en `js/config.js`
  (requiere desactivar la confirmación por email o verificar el enlace).

### 3) Uso en el geoportal

- El mapa y los filtros se cargan sin login (lectura pública).
- Para editar estado, ruta u orden: usar el panel **🔐 Acceso** en la barra lateral.
- Sin sesión, los controles de edición en los popups y el panel de rutas quedan
  ocultos y las escrituras son rechazadas por el backend.
- Al iniciar/cerrar sesión los controles de edición se actualizan al instante
  (sin recargar la página).
- La sesión es **efímera**: `persistSession: false` hace que NO quede guardada
  al cerrar o recargar la página. Cada vez que se abre el geoportal hay que
  volver a ingresar.

### Configuración

Editar `js/config.js`:

```js
export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_KEY = 'tu-anon-key';
export const SUPABASE_ALLOW_SIGNUP = false; // true solo si querés registro abierto
```

> Nunca exponer la `service_role key`. El geoportal solo usa la `anon key`.
