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
console.log('🔧 Configurando conexão com PostgreSQL...');
console.log('📌 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Definida' : '❌ NÃO DEFINIDA');

let pool;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });
  console.log('✅ Pool do PostgreSQL criado');
} catch (err) {
  console.error('❌ Erro ao criar pool:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}

// ===== Testar conexão e criar tabela =====
async function initDatabase() {
  let client = null;
  try {
    console.log('🔄 Tentando conectar ao PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    
    console.log('🔄 Criando tabela "submissions"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela "submissions" verificada/criada com sucesso');
    
    // Testar se a tabela existe
    const testQuery = await client.query('SELECT COUNT(*) FROM submissions');
    console.log(`📊 Total de registros: ${testQuery.rows[0].count}`);
    
    client.release();
    console.log('✅ Banco de dados inicializado com sucesso!');
    return true;
  } catch (err) {
    if (client) client.release();
    console.error('❌ Erro detalhado ao inicializar banco:');
    console.error('  Mensagem:', err.message);
    console.error('  Stack:', err.stack);
    console.error('  Código:', err.code);
    
    // Erros específicos do PostgreSQL
    if (err.code === '28P01') {
      console.error('🔑 ERRO: Credenciais inválidas. Verifique usuário e senha.');
    } else if (err.code === '3D000') {
      console.error('📁 ERRO: Banco de dados não existe. Verifique o nome do banco.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('🌐 ERRO: Conexão recusada. Verifique se o PostgreSQL está rodando.');
    } else if (err.code === 'ENOTFOUND') {
      console.error('🌐 ERRO: Host não encontrado. Verifique a URL do banco.');
    }
    
    return false;
  }
}

// ===== Inicializar banco de dados e iniciar servidor =====
async function startServer() {
  console.log('🚀 Iniciando servidor...');
  
  // Inicializar banco de dados
  const dbInitialized = await initDatabase();
  
  if (!dbInitialized) {
    console.error('❌ Falha ao inicializar o banco de dados. Servidor será encerrado.');
    console.log('💡 Dicas:');
    console.log('  1. Verifique se a variável DATABASE_URL está correta');
    console.log('  2. Verifique se o banco de dados PostgreSQL está rodando');
    console.log('  3. Verifique se as credenciais estão corretas');
    process.exit(1);
  }
  
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
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🕐 Data: ${new Date().toISOString()}`);
  });
}

// ===== Iniciar aplicação =====
startServer();

// ===== Lidar com erros não capturados =====
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('❌ Reason:', reason);
});
