-- Insert Printers (pms_impresora)
INSERT INTO pms_impresora (nombre, nombre_para_mostrar, picture_url, cantidad_alquiladas) VALUES
('VersaLink B7125, B7130, B7135', 'VersaLink B7100', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/b/7/b7125-1000x1000.jpg', 0),
('AltaLink C8030/C8035/C8045/C8055/C8070', 'AltaLink C8045', 'https://www.xerox.com/api/utils/optimise?url=https%3A%2F%2Fwww.xerox.com%2Fassets%2Fimages%2Fbrand_engine%2Fproducts%2Fhardware%2FALC80XX%2Fthumbnail_270x270.png&webp=true', 0),
('VersaLink C7120, C7125, C7130', 'VersaLink C7130', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/c/7/c7120-1000x1000.jpg', 0),
('AltaLink C8130/35/45/55/70, C8230/35/45/55/70', 'AltaLink C8155', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/c/8/c8145-1000x1000.jpg', 0),
('VersaLink B7025, B7030, B7035', 'VersaLink B7035', 'https://www.xerox.com/api/utils/optimise?url=https%3A%2F%2Fwww.xerox.com%2Fassets%2Fimages%2Fbrand_engine%2Fproducts%2Fhardware%2FVLB70XX%2Fthumbnail_270x270.png&webp=true', 0),
('AltaLink B8145, B8155, B8170, B8245, B8255, B8270', 'AltaLink B8155', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/b/8/b8155-1000x1000.jpg', 0),
('VersaLink C410, C415', 'VersaLink C415', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/c/4/c415-dn-1000x1000.jpg', 0);

-- Insert Supplies (pms_suministro) with printer foreign key lookups

-- VersaLink B7125, B7130, B7135 supplies
INSERT INTO pms_suministro (nombre, sku, upc, stock, tipo_suministro, capacidad_paginas, productos_compatibles, picture_url, impresora_id) VALUES
('Black Toner', '006R01818', '95205067835', 0, 'toner', 34300, 'VersaLink B7125, B7130, B7135', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01818_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink B7125, B7130, B7135')),
('Cartucho', '013R00687', '95205067859', 0, 'cartucho', 80000, 'VersaLink B7125, B7130, B7135', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/1/013r00687_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink B7125, B7130, B7135')),

-- AltaLink C8030/C8035/C8045/C8055/C8070 supplies
('Cyan Toner', '006R01698', '95205616989', 0, 'toner', 15000, 'AltaLink C8030,C8035,C8045,C8055,C8070', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01698_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8030/C8035/C8045/C8055/C8070')),
('Yellow Toner', '006R01700', '95205617009', 0, 'toner', 15000, 'AltaLink C8030,C8035,C8045,C8055,C8070', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01700_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8030/C8035/C8045/C8055/C8070')),
('Magenta Toner', '006R01699', '95205616996', 0, 'toner', 15000, 'AltaLink C8030,C8035,C8045,C8055,C8070', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01699_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8030/C8035/C8045/C8055/C8070')),
('Black Toner', '006R01697', '95205616972', 0, 'toner', 26000, 'AltaLink C8030,C8035,C8045,C8055,C8070', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01697_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8030/C8035/C8045/C8055/C8070')),
('Cartucho', '013R00662', '95205136623', 0, 'cartucho', 125000, 'AltaLink C8030, C8035, C8045, C8055, C8070; WorkCentre 7525, 7530, 7535, 7545, 7556, 7830, 7835, 7845, 7855, 7830i, 7835i, 7845i, 7855i, 7970, 7970i, EC7836, EC7856', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/1/013r00662-1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8030/C8035/C8045/C8055/C8070')),

-- VersaLink C7120, C7125, C7130 supplies
('Cyan Toner', '006R01825', '95205067927', 0, 'toner', 18500, 'VersaLink C7120, C7125, C7130', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01825_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C7120, C7125, C7130')),
('Magenta Toner', '006R01826', '95205067934', 0, 'toner', 18500, 'VersaLink C7120, C7125, C7130', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01826_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C7120, C7125, C7130')),
('Yellow Toner', '006R01827', '95205067941', 0, 'toner', 18500, 'VersaLink C7120, C7125, C7130', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01827_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C7120, C7125, C7130')),
('Black Toner', '006R01824', '95205067910', 0, 'toner', 31300, 'VersaLink C7120, C7125, C7130', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01824_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C7120, C7125, C7130')),
('Cartucho', '013R00688', '95205067996', 0, 'cartucho', 87000, 'VersaLink C7120, C7125, C7130', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/1/013r00688_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C7120, C7125, C7130')),

-- AltaLink C8130/35/45/55/70, C8230/35/45/55/70 supplies
('Cyan Toner', '006R01747', '95205617474', 0, 'toner', 28000, 'AltaLink C8130, C8135, C8145, C8155, C8170, C8230, C8235, C8245, C8255, C8270', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01747_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8130/35/45/55/70, C8230/35/45/55/70')),
('Black Toner', '006R01746', '95205617467', 0, 'toner', 59000, 'AltaLink C8130, C8135, C8145, C8155, C8170, C8230, C8235, C8245, C8255, C8270', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01746_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8130/35/45/55/70, C8230/35/45/55/70')),
('Magenta Toner', '006R01748', '95205617481', 0, 'toner', 28000, 'AltaLink C8130, C8135, C8145, C8155, C8170, C8230, C8235, C8245, C8255, C8270', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01748_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8130/35/45/55/70, C8230/35/45/55/70')),
('Yellow Toner', '006R01749', '95205617498', 0, 'toner', 28000, 'AltaLink C8130, C8135, C8145, C8155, C8170, C8230, C8235, C8245, C8255, C8270', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01749_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8130/35/45/55/70, C8230/35/45/55/70')),
('Cartucho', '013R00681', '95205136814', 0, 'cartucho', 180000, 'AltaLink C8130, C8135, C8145, C8155, C8170, C8230, C8235, C8245, C8255, C8270', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/i/c/icon_maintenance-1000x1000_1_38.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink C8130/35/45/55/70, C8230/35/45/55/70')),

-- VersaLink B7025,B7030,B7035 supplies
('Black Toner', '106R03394', '95205833737', 0, 'toner', 31000, 'VersaLink B7025, B7030, B7035', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/1/0/106r03394_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink B7025, B7030, B7035')),
('Cartucho', '113R00779', '95205833768', 0, 'cartucho', 80000, 'VersaLink B7025, B7030, B7035', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/1/1/113r00779_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink B7025, B7030, B7035')),

-- AltaLink B8145, B8155, B8170, B8245, B8255, B8270 supplies
('Black Toner', '006R01771', '95205890990', 0, 'toner', 52000, 'AltaLink B8145, B8155, B8170, B8245, B8255, B8270', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r01771_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink B8145, B8155, B8170, B8245, B8255, B8270')),
('Cartucho', '013R00686', '95205891010', 0, 'cartucho', 200000, 'AltaLink B8145, B8155, B8170, B8245, B8255, B8270', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/i/c/icon_maintenance-1000x1000_1_37.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'AltaLink B8145, B8155, B8170, B8245, B8255, B8270')),

-- VersaLink C410, C415 supplies
('Cyan Toner', '006R04686', '95205039825', 0, 'toner', 7000, 'VersaLink C410, C415', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r04686_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C410, C415')),
('Magenta Toner', '006R04687', '95205039832', 0, 'toner', 7000, 'VersaLink C410, C415', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r04687_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C410, C415')),
('Yellow Toner', '006R04688', '95205039849', 0, 'toner', 7000, 'VersaLink C410, C415', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r04688_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C410, C415')),
('Black Toner', '006R04685', '95205039818', 0, 'toner', 10500, 'VersaLink C410, C415', 'https://www.shop.xerox.com/media/catalog/product/cache/d71c9e55e6299aa8261d6db30899d521/0/0/006r04685_1000x1000.jpg', (SELECT id FROM pms_impresora WHERE nombre = 'VersaLink C410, C415'));

