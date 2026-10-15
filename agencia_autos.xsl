<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html" encoding="UTF-8" indent="yes"/>
    <xsl:template match="/">
        <html lang="es">
            <head>
                <meta charset="UTF-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <title><xsl:value-of select="agencia/titulo"/></title>
                <style>
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 36px; background: #f3f6fc; color: #182b45; font: 15px Arial, sans-serif; }
                    main { max-width: 1200px; margin: auto; }
                    header { padding: 32px; border-radius: 18px; background: linear-gradient(120deg, #102846, #2465c7); color: white; }
                    header p { margin: 0 0 8px; color: #c6dcff; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; }
                    h1 { margin: 0; font-size: 34px; }
                    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
                    .card, .table-wrap { border: 1px solid #e2e9f3; border-radius: 12px; background: white; box-shadow: 0 8px 24px #192b4510; }
                    .card { padding: 20px; }
                    .label { color: #718096; font-size: 12px; }
                    .value { margin-top: 8px; color: #1769e0; font-size: 29px; font-weight: bold; }
                    .table-wrap { overflow-x: auto; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 13px; border-bottom: 1px solid #e9eef5; text-align: left; white-space: nowrap; }
                    th { background: #f7f9fd; color: #50627c; font-size: 11px; text-transform: uppercase; }
                    tr:last-child td { border-bottom: 0; }
                    .photo { width: 76px; height: 52px; border-radius: 7px; object-fit: cover; }
                    .available { color: #14794d; font-weight: bold; }
                    .sold { color: #9b5360; font-weight: bold; }
                    @media (max-width: 650px) { body { padding: 16px; } .stats { grid-template-columns: 1fr; } header { padding: 24px; } h1 { font-size: 26px; } }
                </style>
            </head>
            <body>
                <main>
                    <header><p>Inventario actualizado · ServiDrive</p><h1><xsl:value-of select="agencia/titulo"/></h1></header>
                    <section class="stats">
                        <article class="card"><div class="label">Vehículos registrados</div><div class="value"><xsl:value-of select="count(agencia/autos/auto)"/></div></article>
                        <article class="card"><div class="label">Disponibles</div><div class="value"><xsl:value-of select="count(agencia/autos/auto[estado='Disponible'])"/></div></article>
                        <article class="card"><div class="label">Vendidos</div><div class="value"><xsl:value-of select="count(agencia/autos/auto[estado='Vendida'])"/></div></article>
                    </section>
                    <section class="table-wrap">
                        <table>
                            <thead><tr><th>Foto</th><th>ID</th><th>Marca</th><th>Modelo</th><th>Año</th><th>Tipo</th><th>Precio</th><th>Kilometraje</th><th>Transmisión</th><th>Estado</th></tr></thead>
                            <tbody>
                                <xsl:for-each select="agencia/autos/auto">
                                    <tr>
                                        <td><xsl:if test="foto"><img class="photo" src="{foto}" alt="Foto del vehículo"/></xsl:if></td>
                                        <td><xsl:value-of select="@id"/></td><td><xsl:value-of select="marca"/></td><td><xsl:value-of select="modelo"/></td><td><xsl:value-of select="anio"/></td><td><xsl:value-of select="tipo"/></td><td>$<xsl:value-of select="precio"/></td><td><xsl:value-of select="kilometraje"/> km</td><td><xsl:value-of select="transmision"/></td><td><span><xsl:attribute name="class"><xsl:choose><xsl:when test="estado='Vendida'">sold</xsl:when><xsl:otherwise>available</xsl:otherwise></xsl:choose></xsl:attribute><xsl:value-of select="estado"/></span></td>
                                    </tr>
                                </xsl:for-each>
                            </tbody>
                        </table>
                    </section>
                </main>
            </body>
        </html>
    </xsl:template>
</xsl:stylesheet>
