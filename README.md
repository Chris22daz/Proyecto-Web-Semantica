# ServiDrive

## Iniciar la aplicación

1. Instala Node.js si todavía no está instalado.
2. Abre una terminal en esta carpeta.
3. Ejecuta `npm start`.
4. Abre `http://localhost:3000` en el navegador.

No se requieren paquetes adicionales: el servidor usa módulos incluidos en Node.js.

## Persistencia del inventario

`inventario-db.json` es la fuente persistente que utiliza el servidor local. Al iniciar por primera vez, el servidor importa el inventario que ya tenía guardado la página en el navegador, si existe; de lo contrario usa los vehículos de demostración. Las fotos se guardan dentro de `uploads/`.

Al registrar, editar, vender, reactivar o eliminar un vehículo, la aplicación envía el inventario al servidor. Este guarda el JSON y vuelve a escribir `agencia_autos.xml`, `agencia_autos.xsd`, `agencia_autos.xsl` y `servidrive-inventario.rdf`. El XML se valida con el XSD y contiene la referencia al XSL para mostrar una tabla en los navegadores compatibles. El RDF describe los vehículos con propiedades de Schema.org.

En la pantalla de inventario puedes filtrar y ordenar las unidades, guardar favoritos, comparar hasta tres vehículos y consultar el historial reciente. La ficha de cada auto permite explorar sus datos RDF y generar una cotización imprimible o guardar como PDF. El inicio presenta gráficas por categoría y rango de precio, además de estadísticas del catálogo. Favoritos, comparación e historial se conservan en el almacenamiento local del navegador; el inventario y los artefactos XML/RDF se guardan en el servidor.

El RDF se genera automáticamente junto con los demás artefactos cuando cambia el inventario. Ya no hay una sección independiente ni botones para descargarlo.

Los registros de clientes de demostración se siguen guardando en el almacenamiento local del navegador.
