-- Rol de usuario y bandera de cambio de contraseña obligatorio en el primer ingreso.
alter table pms_usuario
  add column rol text not null default 'admin' check (rol in ('superuser', 'admin'));

alter table pms_usuario
  add column debe_cambiar_password boolean not null default false;

comment on column pms_usuario.rol is 'superuser = acceso total (incluye usuarios); admin = todo excepto la sección de usuarios.';
comment on column pms_usuario.debe_cambiar_password is 'Si es true, la app obliga a cambiar la contraseña antes de continuar.';
