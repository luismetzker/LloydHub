const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIGURAÇÃO DA SESSÃO =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo_super_secreto_123456',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ===== MIDDLEWARES =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== SERVIR ARQUIVOS ESTÁTICOS =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== BANCO DE DADOS SQLITE =====
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');
console.log(`📁 Banco de dados: ${DB_PATH}`);

// Garantir que o diretório existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Conectar ao SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao SQLite:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado ao SQLite');
});

// ===== CRIAR TABELA =====
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Erro ao criar tabela:', err.message);
    } else {
      console.log('✅ Tabela "submissions" verificada/criada');
      
      // Contar registros
      db.get('SELECT COUNT(*) as total FROM submissions', (err, row) => {
        if (!err) {
          console.log(`📊 Total de registros: ${row.total}`);
        }
      });
    }
  });
});

// ===== ROTAS =====

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Página administrativa
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
app.post('/api/submit', (req, res) => {
  const { username, content } = req.body;
  
  if (!username || !content) {
    return res.status(400).json({ error: 'Campos incompletos' });
  }

  db.run(
    'INSERT INTO submissions (username, content) VALUES (?, ?)',
    [username, content],
    function(err) {
      if (err) {
        console.error('❌ Erro ao salvar:', err.message);
        return res.status(500).json({ error: 'Erro ao salvar dados' });
      }
      console.log(`✅ Dado salvo: ${username} - ${content.substring(0, 20)}...`);
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Obter todos os dados (somente autenticado)
app.get('/api/data', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  db.all(
    'SELECT id, username, content, created_at FROM submissions ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar dados:', err.message);
        return res.status(500).json({ error: 'Erro ao buscar dados' });
      }
      res.json(rows);
    }
  );
});

// ===== TRATAMENTO DE ERROS =====
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Banco: SQLite (${DB_PATH})`);
  console.log(`📁 Pasta pública: ${path.join(__dirname, 'public')}`);
});
