require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Sessão =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo_super_secreto',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// ===== Middlewares =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Servir arquivos estáticos da pasta "public" =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== Banco de Dados PostgreSQL =====
let pool;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });
  console.log('✅ Conexão com PostgreSQL configurada');
} catch (err) {
  console.error('❌ Erro ao configurar PostgreSQL:', err);
  process.exit(1);
}

// ===== Testar conexão e criar tabela =====
async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela "submissions" verificada/criada');
    
    client.release();
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err.message);
    // Não sai do processo para permitir fallback em desenvolvimento
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Inicializar banco de dados
initDatabase();

// ===== ROTAS =====

// Rota principal
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
    const result = await pool.query(
      'INSERT INTO submissions (username, content) VALUES ($1, $2) RETURNING id',
      [username, content]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('❌ Erro ao salvar:', err.message);
    res.status(500).json({ error: 'Erro no servidor ao salvar dados' });
  }
});

// Obter todos os dados (somente autenticado)
app.get('/api/data', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, content, created_at FROM submissions ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar dados:', err.message);
    res.status(500).json({ error: 'Erro no servidor ao buscar dados' });
  }
});

// ===== Tratamento de erros =====
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ===== Iniciar servidor =====
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
