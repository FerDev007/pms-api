-- Equipos nuevos del edificio HN3 detectados en el inventario de terminales.
-- Modelo por defecto VersaLink B7100 (mono); ajustar en la app si alguno difiere.
-- on conflict do nothing: idempotente y seguro si se reejecuta o corre tras el seed.
insert into pms_impresora_en_sitio (ip, a_color, nombre, impresora_id)
select v.ip, v.a_color, v.nombre, p.id
from (values
  ('10.136.67.48',  false, 'Oficina primer piso HN3',  'VersaLink B7125, B7130, B7135'),
  ('10.136.67.70',  false, 'Corte HN03',               'VersaLink B7125, B7130, B7135'),
  ('10.136.67.74',  false, 'Fakra HN3',                'VersaLink B7125, B7130, B7135'),
  ('10.136.67.150', false, 'Oficina segundo piso HN3', 'VersaLink B7125, B7130, B7135')
) as v(ip, a_color, nombre, modelo)
join pms_impresora p on p.nombre = v.modelo
on conflict do nothing;
