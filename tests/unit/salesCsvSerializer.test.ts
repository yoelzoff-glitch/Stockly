import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  serializeSalesExportCsv,
  SALES_CSV_HEADERS,
  type ExportableOrder,
} from "../../src/lib/export/salesCsvSerializer";

describe("Sales CSV Export Serializer Tests", () => {
  const sampleOrders: ExportableOrder[] = [
    {
      date_created: "2026-08-15T14:30:00.000Z",
      meli_order_id: "2000001122334455",
      buyer_nickname: "JUAN_PEREZ",
      product_title: 'Auriculares Bluetooth, "Noise Cancelling", Pro',
      total_amount: 154000.5,
      status: "paid",
      raw_data: {
        order_items: [
          { quantity: 2, item: { title: 'Auriculares Bluetooth, "Noise Cancelling", Pro' } },
          { quantity: 1, item: { title: "Cable Auxiliar Extra" } },
        ],
      },
    },
    {
      date_created: "2026-08-16T18:00:00.000Z",
      meli_order_id: "2000009988776655",
      buyer_nickname: 'MARIA "LA COLO"',
      product_title: "Funda Silicona Roja",
      total_amount: 12500,
      status: "delivered",
      raw_data: null,
    },
  ];

  test("generates exact CSV headers in 58211d3 order separated by commas", () => {
    const csv = serializeSalesExportCsv([]);
    const lines = csv.split("\n");
    assert.equal(lines.length, 1);
    assert.equal(
      lines[0],
      "Fecha,Nº Orden,Comprador,Producto,Cantidad,Total (ARS),Estado"
    );
    assert.deepEqual(SALES_CSV_HEADERS, [
      "Fecha",
      "Nº Orden",
      "Comprador",
      "Producto",
      "Cantidad",
      "Total (ARS)",
      "Estado",
    ]);
  });

  test("escapes inner commas and double quotes correctly in titles and buyer nicknames", () => {
    const csv = serializeSalesExportCsv(sampleOrders);
    const lines = csv.split("\n");
    assert.equal(lines.length, 3);

    // Row 1
    const row1 = lines[1];
    assert.ok(row1.includes("2000001122334455"));
    assert.ok(row1.includes('"JUAN_PEREZ"'));
    // Quotes inside title should be doubled: ""Noise Cancelling""
    assert.ok(row1.includes('"Auriculares Bluetooth, ""Noise Cancelling"", Pro"'));
    // Sum of quantities: 2 + 1 = 3
    assert.ok(row1.includes(",3,154000.5,paid"));

    // Row 2
    const row2 = lines[2];
    assert.ok(row2.includes("2000009988776655"));
    assert.ok(row2.includes('"MARIA ""LA COLO"""'));
    assert.ok(row2.includes('"Funda Silicona Roja"'));
    assert.ok(row2.includes(",1,12500,delivered"));
  });

  test("filters orders by search term against buyer nickname, order ID, and title", () => {
    // Search by buyer nickname
    const resBuyer = serializeSalesExportCsv(sampleOrders, "juan");
    assert.equal(resBuyer.split("\n").length, 2);
    assert.ok(resBuyer.includes("JUAN_PEREZ"));

    // Search by order ID
    const resOrderId = serializeSalesExportCsv(sampleOrders, "9988776655");
    assert.equal(resOrderId.split("\n").length, 2);
    assert.ok(resOrderId.includes("2000009988776655"));

    // Search by product title
    const resTitle = serializeSalesExportCsv(sampleOrders, "silicona");
    assert.equal(resTitle.split("\n").length, 2);
    assert.ok(resTitle.includes("Funda Silicona Roja"));

    // Search with no matches
    const resNone = serializeSalesExportCsv(sampleOrders, "non-existent-search");
    assert.equal(resNone.split("\n").length, 1); // Only headers
  });

  test("aggregates quantity accurately and falls back gracefully when raw_data is missing", () => {
    const singleOrder: ExportableOrder[] = [
      {
        date_created: "2026-08-20T10:00:00.000Z",
        meli_order_id: "12345",
        buyer_nickname: "TEST_BUYER",
        product_title: "Producto Simple",
        total_amount: 5000,
        status: "paid",
        raw_data: {
          order_items: [{ quantity: 5 }],
        },
      },
      {
        date_created: "2026-08-20T11:00:00.000Z",
        meli_order_id: "67890",
        buyer_nickname: "TEST_BUYER_2",
        product_title: "Producto Sin Raw Data",
        total_amount: 3000,
        status: "paid",
        raw_data: null,
      },
    ];

    const csv = serializeSalesExportCsv(singleOrder);
    const lines = csv.split("\n");
    assert.ok(lines[1].includes(",5,5000,paid"));
    assert.ok(lines[2].includes(",1,3000,paid"));
  });

  test("Snapshot: 0 rows generates exact single header line", () => {
    const csv = serializeSalesExportCsv([]);
    assert.equal(csv, "Fecha,Nº Orden,Comprador,Producto,Cantidad,Total (ARS),Estado");
  });

  test("Snapshot: 1 row generates exact es-AR formatted row matching contract", () => {
    const single: ExportableOrder[] = [
      {
        date_created: "2026-09-01T15:30:00.000Z",
        meli_order_id: "MLA-1001",
        buyer_nickname: "CARLOS_GOMEZ",
        product_title: "Termo Lumilagro 1L",
        total_amount: 35000,
        status: "paid",
        raw_data: {
          order_items: [{ quantity: 2, item: { title: "Termo Lumilagro 1L" } }],
        },
      },
    ];

    const expectedDate = new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date("2026-09-01T15:30:00.000Z"));

    const csv = serializeSalesExportCsv(single);
    const lines = csv.split("\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[0], "Fecha,Nº Orden,Comprador,Producto,Cantidad,Total (ARS),Estado");
    assert.equal(
      lines[1],
      `${expectedDate},MLA-1001,"CARLOS_GOMEZ","Termo Lumilagro 1L",2,35000,paid`
    );
  });

  test("Scalability: handles > 1000 rows (1,250 rows) with no row loss or duplicates across batches", () => {
    const TOTAL_ROWS = 1250;
    const BATCH_SIZE = 500;
    const mockDbOrders: ExportableOrder[] = [];

    for (let i = 1; i <= TOTAL_ROWS; i++) {
      mockDbOrders.push({
        date_created: new Date(Date.now() - i * 60000).toISOString(),
        meli_order_id: `ORD-STREAM-${i}`,
        buyer_nickname: `BUYER_${i}`,
        product_title: `Item ${i}`,
        total_amount: 1000 + i,
        status: "paid",
        raw_data: { order_items: [{ quantity: 1, item: { title: `Item ${i}` } }] },
      });
    }

    // Simulate batch-by-batch fetching and accumulation
    let accumulated: ExportableOrder[] = [];
    let offset = 0;
    while (offset < mockDbOrders.length) {
      const batch = mockDbOrders.slice(offset, offset + BATCH_SIZE);
      accumulated = accumulated.concat(batch);
      offset += BATCH_SIZE;
    }

    assert.equal(accumulated.length, TOTAL_ROWS);

    const csv = serializeSalesExportCsv(accumulated);
    const lines = csv.split("\n");

    // Header + 1250 data lines = 1251 lines
    assert.equal(lines.length, TOTAL_ROWS + 1);

    // Verify first and last row order
    assert.ok(lines[1].includes("ORD-STREAM-1"));
    assert.ok(lines[TOTAL_ROWS].includes(`ORD-STREAM-${TOTAL_ROWS}`));

    // Verify no duplicates by checking unique order IDs in CSV
    const orderIds = lines.slice(1).map((l) => l.split(",")[1]);
    const uniqueIds = new Set(orderIds);
    assert.equal(uniqueIds.size, TOTAL_ROWS, "Every single row must be unique with zero duplicate rows");
  });
});
