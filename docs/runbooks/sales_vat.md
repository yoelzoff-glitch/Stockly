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

- Comisiones y envíos: reporte de facturación ML, automáticamente al consultar Contabilidad,
  guardado por cuenta/mes durante 24 horas. Solo cuentas MLA. Se consideran códigos CV y CXD,
  restando BV y BXD respectivamente y extrayendo el IVA incluido al 21%. Son **estimaciones**,
  no lectura del IVA discriminado en PDF. No incluye publicidad, Full, otros cargos ni percepciones.
- Compras opcionales: referencia del comprobante, tipo A/C/otro, IVA discriminado en ARS y
  selección explícita de crédito computable. C/otro no admiten crédito. No afecta stock.
- Otros créditos, retenciones, percepciones, pagos a cuenta y saldos anteriores: carga manual,
  sin repetir ML ni comprobantes ya ingresados. El traslado entre meses no es automático.

El período del reporte ML se muestra explícitamente: puede diferir del mes calendario fiscal.
Antes de presentar, validar con las facturas y notas de crédito. El campo ARCA corresponde
al saldo a ingresar de la declaración cargado manualmente; no representa deuda en tiempo real,
intereses ni pagos posteriores, y no hay integración ni presentación automática en ARCA.

Saldo técnico = débito − créditos − saldo técnico anterior. Solo su parte positiva
se reduce por retenciones, percepciones, pagos a cuenta y libre disponibilidad anterior.
Se conservan por separado los saldos a favor técnico y de libre disponibilidad.

Los errores de ML no se convierten en crédito cero; impiden guardar un nuevo cálculo.
La última conciliación es un snapshot y no se altera al cambiar la alícuota ni al sincronizar
ventas. La card lo identifica como último guardado. La escritura usa revisión optimista
para evitar pisar cambios de otra sesión y verifica los importes ML del lado servidor.

Fuentes:
- https://developers.mercadolibre.com.ar/es_ar/pagos/reportes-de-facturacion
- https://vendedores.mercadolibre.com.ar/aprender/nota/como-puedo-conciliar-el-reporte-de-detalle-del-periodo?guideKeyId=GE19
- https://www.afip.ar/iva/iva-simple/confeccion-declaracion.asp

Si falla la lectura, se muestra un error y nunca un saldo cero sustituto.
La configuración tiene RLS por cuenta y escritura limitada a propietarios/administradores.

## Validación

`npm run typecheck`

`node -r ./tests/setup.cjs --import tsx --test tests/unit/salesVat.test.ts tests/unit/salesVatRls.test.ts tests/unit/vatReconciliation.test.ts`

Prueba de interfaz con una sesión real: activar y guardar, cambiar el mes,
recargar para comprobar persistencia y desactivar. Confirmar que otra cuenta
no ve la configuración ni los datos y que un usuario sin permisos no puede modificarlos.
