# Observabilidad — ver los logs en Kibana

El API escribe una línea JSON por evento a stdout. Filebeat la recoge del contenedor,
Elasticsearch la indexa y Kibana la consulta. Este documento cubre el último tramo: cómo
dejar Kibana listo y qué mirar.

Todo lo de aquí vive en el perfil `observability`, que no arranca con un `docker compose up`
normal.

## 1 · Levantar el stack

```sh
docker compose --profile observability up -d
# o: just observability
```

Elasticsearch tarda ~40 s en quedar `healthy` y Kibana otro tanto en responder.

| Servicio | Por defecto | En esta máquina |
|---|---|---|
| Kibana | <http://localhost:5601> | <http://localhost:5602> |
| Elasticsearch | <http://localhost:9200> | <http://localhost:9201> |

Los puertos por defecto están ocupados aquí por otro stack, así que `.env` define
`KIBANA_PORT=5602` y `ES_PORT=9201`. En una máquina limpia puedes borrar esas dos líneas.

## 2 · Crear la data view

Kibana no muestra nada hasta que exista una *data view* que apunte al índice. Guarda ese
objeto en su propio volumen, así que **se hace una vez por volumen de Kibana**, no una vez por
clon del repo: si haces `docker compose --profile observability down -v` habrá que repetirlo.

### Con el script (recomendado)

```sh
./observability/setup-kibana.sh
# si Kibana no está en el puerto por defecto:
KIBANA_URL=http://localhost:5602 ./observability/setup-kibana.sh
```

Espera a que Kibana responda y crea la vista. Es idempotente: si ya existe lo dice y sale con
código 0, así que puedes encadenarlo sin condicionales.

### A mano, desde la UI

☰ → **Stack Management → Data Views → Create data view**:

| Campo | Valor |
|---|---|
| Name | `caribe-logs` |
| Index pattern | `caribe-logs-*` |
| Timestamp field | `@timestamp` |

### A mano, por API

```sh
curl -X POST 'http://localhost:5602/api/data_views/data_view' \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"data_view":{"title":"caribe-logs-*","name":"caribe-logs","timeFieldName":"@timestamp"}}'
```

> **El campo de tiempo es `@timestamp`, no `hora`.** `@timestamp` lo pone Filebeat al recoger
> la línea; `hora` es el instante que escribe el API y está mapeado como `keyword`, así que
> Kibana no lo acepta como campo de tiempo. `hora` te sirve igual para leer el instante exacto
> dentro de cada documento, y es el que vale si alguna vez dudas del desfase entre que el API
> emite y Filebeat recoge.

## 3 · Mirar los eventos

☰ → **Analytics → Discover**, elige `caribe-logs` arriba a la izquierda.

**Pon el rango en "Last 24 hours".** Por defecto son 15 minutos y lo normal es no ver nada y
pensar que el pipeline está roto.

Al pulsar un campo en el panel izquierdo (`evento`, `estado`, `detalle`) Kibana muestra el top
de valores con su porcentaje — es la lectura más rápida de la salud del sistema.

### Campos

| Campo | Tipo | Contenido |
|---|---|---|
| `evento` | keyword | `reserva_creada` · `reserva_confirmada` · `concierge_consulta` · `fallo` |
| `estado` | keyword | `ok` \| `error` |
| `duracion_ms` | long | duración de la operación; `0` en `fallo` |
| `usuario` | keyword | id seudónimo (`u_` + SHA-256 recortado), o `anonimo` |
| `detalle` | keyword | código de reserva, `match`/`sin_match`, o el motivo del fallo |
| `hora` | keyword | instante que escribió el API, en RFC 3339 |

Las líneas de log humanas del API no son JSON: llegan al mismo índice con su texto en
`message` y sin estos campos. Filtrar por `evento: *` te deja solo los eventos.

### Consultas (KQL)

| Pregunta | Consulta |
|---|---|
| ¿Qué falló? | `estado: "error"` |
| ¿El concierge está sano? | `evento: "concierge_consulta"` → desglosa por `estado` |
| ¿Se cae o solo va lento? | `evento: "concierge_consulta" and estado: "error"` → desglosa por `detalle` |
| ¿Cuántas veces no encontramos nada? | `evento: "concierge_consulta" and detalle: "sin_match"` |
| Reservas | `evento: "reserva_creada"` |
| Recorrido de un viajero | `usuario: "u_4cb2c311cd2b"` — enlaza su reserva con su confirmación |
| Errores de API sin ruido del concierge | `evento: "fallo"` → desglosa por `detalle` |
| Solo eventos, sin logs humanos | `evento: *` |

Motivos posibles de un `concierge_consulta` en error: `inalcanzable`, `timeout`,
`respuesta_invalida`, `paquete_inexistente`, `desactivado`.

### Latencia del concierge

Filtra `evento: "concierge_consulta" and estado: "ok"`, pulsa **`duracion_ms`** en el panel
izquierdo y elige **Visualize**. Cambia la métrica a **Average**. Ronda los 26 s por llamada
con el catálogo actual.

Sin pasar por la UI:

```sh
curl -s 'http://localhost:9201/caribe-logs-*/_search' -H 'Content-Type: application/json' -d '{
  "size": 0,
  "query": { "term": { "evento": "concierge_consulta" } },
  "aggs": {
    "latencia_ms": { "avg": { "field": "duracion_ms" } },
    "por_estado":  { "terms": { "field": "estado" } }
  }}'
```

## 4 · Si Discover sale vacío

Por orden, de la causa más común a la menos:

1. **El rango de tiempo.** Súbelo a *Last 24 hours*.
2. **No hay tráfico todavía.** Genera algo: `curl http://localhost:8088/api/bookings/CB-NADA`
   produce un `fallo` al instante.
3. **Elasticsearch aún no refrescó.** Hay hasta ~1 s de retraso, más el intervalo de Filebeat.
   Confirma con `curl -s 'http://localhost:9201/caribe-logs-*/_count'`.
4. **El API no está emitiendo.** Míralo en crudo:
   `docker logs caribe-api | grep '^{"evento"'`.
5. **Filebeat no está publicando.** `docker logs caribe-filebeat | grep -i error`. Al arrancar
   suele aparecer un error de plantilla que se recupera solo en el siguiente intento; solo
   preocúpate si se repite.

## Privacidad

Nunca se registran contraseñas, tokens, nombres, teléfonos ni correos completos. `usuario` es
un SHA-256 recortado del correo: sirve para seguir a un viajero entre eventos, no para
identificarlo. Hay pruebas unitarias que lo comprueban, y sobre el índice vivo se verificó que
buscar la dirección, el teléfono y el nombre de una reserva de prueba devuelve cero resultados.

Si añades campos a un evento, la regla es: nada que venga del `contact` de una reserva.
