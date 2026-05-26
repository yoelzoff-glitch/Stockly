UPDATE products SET sku_normalized = REPLACE(sku_normalized, ' ', '');
UPDATE inventory_items SET sku_normalized = REPLACE(sku_normalized, ' ', '');
UPDATE product_components SET component_sku = REPLACE(component_sku, ' ', '');
