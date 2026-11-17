# IVA acumulado de ventas

Aplicar, en orden, las migraciones `20261116000000_sales_vat_settings.sql`,
`20261116000001_vat_reconciliations.sql` y `20261116000002_meli_vat_reports.sql` antes de desplegar.
No modifica órdenes, rentabilidad ni gastos existentes. El módulo está desactivado por defecto.

En **Contabilidad**, un propietario o administrador activo puede marcar
**Soy responsable inscripto: activar módulo**, elegir una alícuota y guardar.
Los demás usuarios activos de la cuenta pueden consultar el resultado.
El selector de período existente permite consultar meses anteriores.

## Alcance del cálculo

- Órdenes con estado `paid`, moneda `ARS` e importe válido no negativo.
- Período según `date_created` y zona horaria de la cuenta, inicio inclusivo y siguiente mes exclusivo.
- Excluye órdenes ocultas por ID interno o ID de Mercado Libre.
- Precio final con IVA incluido: `IVA = importe × alícuota / (100 + alícuota)`.
- Redondeo a centavos por orden y acumulación del mes.
- Alícuota única configurada por cuenta, aplicada también al consultar períodos anteriores.
- No es una liquidación fiscal ni usa fecha o importes de comprobantes fiscales.
- El acumulado de ventas no calcula notas de crédito ni ajustes por devoluciones parciales,
  ni separa alícuotas por producto. El débito se puede corregir en la conciliación mensual.

## Finanzas y conciliación

Finanzas muestra una card con el IVA de ventas actualizado y el saldo estimado de la
última conciliación guardada, junto al saldo ARCA cargado y su diferencia. El mes anterior
usa su propio período; los rangos móviles/todo el historial muestran el mes actual de IVA.

La conciliación tiene tres fuentes de crédito:

- Comisiones y envíos: toma `comisionesML` y `envios` de `getFinancialData` para el mismo mes y zona horaria de la cuenta, igual que Finanzas. Extrae aproximadamente el IVA incluido al 21% (`monto × 21 / 121`). Se muestra **Aproximado · desde Finanzas**. No consulta la API de reportes de ML ni depende de su caché. Puede incluir costos estimados o envíos sin crédito computable; requiere revisión contra comprobantes.
- Compras opcionales: referencia del comprobante, tipo A/C/otro, IVA discriminado en ARS y
  selección explícita de crédito computable. C/otro no admiten crédito. No afecta stock.
- Publicidad: gastos registrados cuyo nombre contiene Publicidad, Ads o Advertising.
  Usa el IVA agregado por `has_iva` sobre el presupuesto base acumulado, sin volver a
  multiplicar un total que ya contiene IVA. Respeta los días transcurridos, fechas y
  versiones del presupuesto calculados por Finanzas. No consulta la API de Ads.
  Se identifica como aproximación del presupuesto; no confirma inversión facturada.
  Los gastos sin “+21% de IVA” no suman crédito. No repetir esos importes en otros créditos.
- Otros créditos, retenciones, percepciones, pagos a cuenta y saldos anteriores: carga manual,
  sin repetir ML ni comprobantes ya ingresados. El traslado entre meses no es automático.

Se usa el mes calendario de la cuenta. Antes de presentar, validar con las facturas y notas de crédito. El campo ARCA corresponde
al saldo a ingresar de la declaración cargado manualmente; no representa deuda en tiempo real,
intereses ni pagos posteriores, y no hay integración ni presentación automática en ARCA.

Saldo técnico = débito − créditos − saldo técnico anterior. Solo su parte positiva
se reduce por retenciones, percepciones, pagos a cuenta y libre disponibilidad anterior.
Se conservan por separado los saldos a favor técnico y de libre disponibilidad.

Los errores al cargar Finanzas no se convierten en crédito cero; impiden guardar un nuevo cálculo.
La última conciliación es un snapshot y no se altera al cambiar la alícuota ni al sincronizar
ventas. La card lo identifica como último guardado. La escritura usa revisión optimista
para evitar pisar cambios de otra sesión y recalcula los importes de Finanzas del lado servidor. Si cambiaron desde la vista previa, pide recargar. Los nuevos registros guardan `creditSource: finance_approximation`; las conciliaciones anteriores siguen siendo legibles. No requiere nuevas migraciones.

Fuentes:
- https://developers.mercadolibre.com.ar/es_ar/pagos/reportes-de-facturacion
- https://vendedores.mercadolibre.com.ar/aprender/nota/como-puedo-conciliar-el-reporte-de-detalle-del-periodo?guideKeyId=GE19
- https://www.afip.ar/iva/iva-simple/confeccion-declaracion.asp

Si falla la lectura, se muestra un error y nunca un saldo cero sustituto.
La configuración tiene RLS por cuenta y escritura limitada a propietarios/administradores.

## Validación

`npm run typecheck`

`node -r ./tests/setup.cjs --import tsx --test tests/unit/salesVat.test.ts tests/unit/salesVatRls.test.ts tests/unit/vatReconciliation.test.ts tests/unit/financeVat.test.ts`

Prueba de interfaz con una sesión real: activar y guardar, cambiar el mes,
recargar para comprobar persistencia y desactivar. Confirmar que otra cuenta
no ve la configuración ni los datos y que un usuario sin permisos no puede modificarlos.
