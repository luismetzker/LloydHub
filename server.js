require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Configuração da sessão =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo_super_secreto',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// ===== Middlewares =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Servir arquivos estáticos da pasta "public" =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== Banco de Dados SQLite =====
let db;

(async () => {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  // Criar tabela se não existir
  await db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Banco SQLite e tabela "submissions" prontos.');
})();

// ===== ROTAS =====

// Rota principal – serve o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota da página administrativa
app.get('/GodsTech-elpepe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'GodsTech-elpepe.html'));
});

// ===== API =====

// Verificar autenticação
app.get('/api/check-auth', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// Login admin
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === 'elpepe o melhor de todos') {
    req.session.authenticated = true;
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Senha incorreta' });
  }
});

// Logout
app.post('/api/admin-logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Receber envio do index (salvar no banco)
app.post('/api/submit', async (req, res) => {
  const { username, content } = req.body;
  if (!username || !content) {
    return res.status(400).json({ error: 'Campos incompletos' });
  }
  try {
    await db.run(
      'INSERT INTO submissions (username, content) VALUES (?, ?)',
      [username, content]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Obter todos os dados (somente autenticado)
app.get('/api/data', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  try {
    const rows = await db.all(
      'SELECT id, username, content, created_at FROM submissions ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ===== Iniciar servidor =====
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});