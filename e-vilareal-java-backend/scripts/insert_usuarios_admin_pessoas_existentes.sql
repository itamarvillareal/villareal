SET @senha_123456 = '$2a$10$m2m366PkPAQeHNB4o3uQQ.An0s/NcT097ZikNcRCJXOnFPs2caK.m';

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo, perfil_id)
VALUES (1085, 'KARLA CAROLINE PEDROZA SILVA', NULL, 'karla.pedroza@villarealadvocacia.adv.br', @senha_123456, TRUE, 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo, perfil_id)
VALUES (6899, 'ANA LUISA NUNES D ABADIA', NULL, 'analuisanunesdabadia@gmail.com', @senha_123456, TRUE, 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo, perfil_id)
VALUES (867, 'ITAMAR ALEXANDRE FELIX VILLA REAL', NULL, 'itamarvillareal@gmail.com', @senha_123456, TRUE, 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo, perfil_id)
VALUES (868, 'ITAMAR ALEXANDRE FELIX VILLA REAL', NULL, 'itamarvillareal+868@gmail.com', @senha_123456, TRUE, 1);
