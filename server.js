const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Configuração da Sessão =====
app.use(session({
  secret: 'segredo_super_secreto_123456',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ===== Middlewares =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Servir arquivos estáticos =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== BANCO DE DADOS SQLITE =====
const Database = require('better-sqlite3');

// Caminho do banco de dados
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');
console.log(`📁 Banco de dados: ${dbPath}`);

// Conectar ao SQLite
let db;
try {
  db = new Database(dbPath);
  console.log('✅ Conectado ao SQLite');
} catch (err) {
  console.error('❌ Erro ao conectar ao SQLite:', err.message);
  process.exit(1);
}

// Criar tabela
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Tabela "submissions" criada/verificada');
  
  // Contar registros
  const count = db.prepare('SELECT COUNT(*) as total FROM submissions').get();
  console.log(`📊 Total de registros: ${count.total}`);
} catch (err) {
  console.error('❌ Erro ao criar tabela:', err.message);
  process.exit(1);
}

// ===== ROTAS =====

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota administrativa
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

// Receber envio (salvar no banco)
app.post('/api/submit', async (req, res) => {
  const { username, content } = req.body;
  
  if (!username || !content) {
    return res.status(400).json({ error: 'Campos incompletos' });
  }

  try {
    const stmt = db.prepare('INSERT INTO submissions (username, content) VALUES (?, ?)');
    const info = stmt.run(username, content);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error('❌ Erro ao salvar:', err.message);
    res.status(500).json({ error: 'Erro ao salvar dados' });
  }
});

// Obter todos os dados (somente autenticado)
app.get('/api/data', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const stmt = db.prepare('SELECT * FROM submissions ORDER BY created_at DESC');
    const rows = stmt.all();
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar dados:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// ===== Iniciar servidor =====
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Banco de dados: ${dbPath}`);
});
