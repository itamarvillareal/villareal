SET @senha = '$2a$10$m2m366PkPAQeHNB4o3uQQ.An0s/NcT097ZikNcRCJXOnFPs2caK.m';
INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (1, 'Usuário Teste 1', NULL, 'teste.pessoa.001', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (2, 'Usuário Teste 2', NULL, 'teste.pessoa.002', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (3, 'Usuário Teste 3', NULL, 'teste.pessoa.003', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (4, 'Usuário Teste 4', NULL, 'teste.pessoa.004', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (5, 'Usuário Teste 5', NULL, 'teste.pessoa.005', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (6, 'Usuário Teste 6', NULL, 'teste.pessoa.006', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (7, 'Usuário Teste 7', NULL, 'teste.pessoa.007', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (8, 'Usuário Teste 8', NULL, 'teste.pessoa.008', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (9, 'Usuário Teste 9', NULL, 'teste.pessoa.009', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (10, 'Usuário Teste 10', NULL, 'teste.pessoa.010', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (11, 'Usuário Teste 11', NULL, 'teste.pessoa.011', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (12, 'Usuário Teste 12', NULL, 'teste.pessoa.012', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (13, 'Usuário Teste 13', NULL, 'teste.pessoa.013', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (14, 'Usuário Teste 14', NULL, 'teste.pessoa.014', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (15, 'Usuário Teste 15', NULL, 'teste.pessoa.015', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (16, 'Usuário Teste 16', NULL, 'teste.pessoa.016', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (17, 'Usuário Teste 17', NULL, 'teste.pessoa.017', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (18, 'Usuário Teste 18', NULL, 'teste.pessoa.018', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (19, 'Usuário Teste 19', NULL, 'teste.pessoa.019', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (20, 'Usuário Teste 20', NULL, 'teste.pessoa.020', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (21, 'Usuário Teste 21', NULL, 'teste.pessoa.021', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (22, 'Usuário Teste 22', NULL, 'teste.pessoa.022', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (23, 'Usuário Teste 23', NULL, 'teste.pessoa.023', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (24, 'Usuário Teste 24', NULL, 'teste.pessoa.024', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (25, 'Usuário Teste 25', NULL, 'teste.pessoa.025', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (26, 'Usuário Teste 26', NULL, 'teste.pessoa.026', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (27, 'Usuário Teste 27', NULL, 'teste.pessoa.027', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (28, 'Usuário Teste 28', NULL, 'teste.pessoa.028', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (29, 'Usuário Teste 29', NULL, 'teste.pessoa.029', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (30, 'Usuário Teste 30', NULL, 'teste.pessoa.030', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (31, 'Usuário Teste 31', NULL, 'teste.pessoa.031', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (32, 'Usuário Teste 32', NULL, 'teste.pessoa.032', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (33, 'Usuário Teste 33', NULL, 'teste.pessoa.033', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (34, 'Usuário Teste 34', NULL, 'teste.pessoa.034', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (35, 'Usuário Teste 35', NULL, 'teste.pessoa.035', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (36, 'Usuário Teste 36', NULL, 'teste.pessoa.036', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (37, 'Usuário Teste 37', NULL, 'teste.pessoa.037', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (38, 'Usuário Teste 38', NULL, 'teste.pessoa.038', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (39, 'Usuário Teste 39', NULL, 'teste.pessoa.039', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (40, 'Usuário Teste 40', NULL, 'teste.pessoa.040', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (41, 'Usuário Teste 41', NULL, 'teste.pessoa.041', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (42, 'Usuário Teste 42', NULL, 'teste.pessoa.042', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (43, 'Usuário Teste 43', NULL, 'teste.pessoa.043', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (44, 'Usuário Teste 44', NULL, 'teste.pessoa.044', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (45, 'Usuário Teste 45', NULL, 'teste.pessoa.045', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (46, 'Usuário Teste 46', NULL, 'teste.pessoa.046', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (47, 'Usuário Teste 47', NULL, 'teste.pessoa.047', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (48, 'Usuário Teste 48', NULL, 'teste.pessoa.048', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (49, 'Usuário Teste 49', NULL, 'teste.pessoa.049', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (50, 'Usuário Teste 50', NULL, 'teste.pessoa.050', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (51, 'Usuário Teste 51', NULL, 'teste.pessoa.051', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (52, 'Usuário Teste 52', NULL, 'teste.pessoa.052', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (53, 'Usuário Teste 53', NULL, 'teste.pessoa.053', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (54, 'Usuário Teste 54', NULL, 'teste.pessoa.054', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (55, 'Usuário Teste 55', NULL, 'teste.pessoa.055', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (56, 'Usuário Teste 56', NULL, 'teste.pessoa.056', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (57, 'Usuário Teste 57', NULL, 'teste.pessoa.057', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (58, 'Usuário Teste 58', NULL, 'teste.pessoa.058', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (59, 'Usuário Teste 59', NULL, 'teste.pessoa.059', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (60, 'Usuário Teste 60', NULL, 'teste.pessoa.060', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (61, 'Usuário Teste 61', NULL, 'teste.pessoa.061', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (62, 'Usuário Teste 62', NULL, 'teste.pessoa.062', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (63, 'Usuário Teste 63', NULL, 'teste.pessoa.063', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (64, 'Usuário Teste 64', NULL, 'teste.pessoa.064', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (65, 'Usuário Teste 65', NULL, 'teste.pessoa.065', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (66, 'Usuário Teste 66', NULL, 'teste.pessoa.066', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (67, 'Usuário Teste 67', NULL, 'teste.pessoa.067', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (68, 'Usuário Teste 68', NULL, 'teste.pessoa.068', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (69, 'Usuário Teste 69', NULL, 'teste.pessoa.069', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (70, 'Usuário Teste 70', NULL, 'teste.pessoa.070', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (71, 'Usuário Teste 71', NULL, 'teste.pessoa.071', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (72, 'Usuário Teste 72', NULL, 'teste.pessoa.072', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (73, 'Usuário Teste 73', NULL, 'teste.pessoa.073', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (74, 'Usuário Teste 74', NULL, 'teste.pessoa.074', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (75, 'Usuário Teste 75', NULL, 'teste.pessoa.075', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (76, 'Usuário Teste 76', NULL, 'teste.pessoa.076', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (77, 'Usuário Teste 77', NULL, 'teste.pessoa.077', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (78, 'Usuário Teste 78', NULL, 'teste.pessoa.078', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (79, 'Usuário Teste 79', NULL, 'teste.pessoa.079', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (80, 'Usuário Teste 80', NULL, 'teste.pessoa.080', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (81, 'Usuário Teste 81', NULL, 'teste.pessoa.081', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (82, 'Usuário Teste 82', NULL, 'teste.pessoa.082', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (83, 'Usuário Teste 83', NULL, 'teste.pessoa.083', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (84, 'Usuário Teste 84', NULL, 'teste.pessoa.084', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (85, 'Usuário Teste 85', NULL, 'teste.pessoa.085', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (86, 'Usuário Teste 86', NULL, 'teste.pessoa.086', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (87, 'Usuário Teste 87', NULL, 'teste.pessoa.087', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (88, 'Usuário Teste 88', NULL, 'teste.pessoa.088', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (89, 'Usuário Teste 89', NULL, 'teste.pessoa.089', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (90, 'Usuário Teste 90', NULL, 'teste.pessoa.090', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (91, 'Usuário Teste 91', NULL, 'teste.pessoa.091', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (92, 'Usuário Teste 92', NULL, 'teste.pessoa.092', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (93, 'Usuário Teste 93', NULL, 'teste.pessoa.093', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (94, 'Usuário Teste 94', NULL, 'teste.pessoa.094', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (95, 'Usuário Teste 95', NULL, 'teste.pessoa.095', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (96, 'Usuário Teste 96', NULL, 'teste.pessoa.096', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (97, 'Usuário Teste 97', NULL, 'teste.pessoa.097', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (98, 'Usuário Teste 98', NULL, 'teste.pessoa.098', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (99, 'Usuário Teste 99', NULL, 'teste.pessoa.099', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 2);

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo)
VALUES (100, 'Usuário Teste 100', NULL, 'teste.pessoa.100', @senha, TRUE);
INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (LAST_INSERT_ID(), 1);

