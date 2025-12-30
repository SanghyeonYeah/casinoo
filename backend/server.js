const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL 연결 설정
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'probability_game',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password'
});

// 미들웨어
app.use(cors());
app.use(express.json());

// 데이터베이스 테이블 초기화
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        is_teacher BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_states (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(50) REFERENCES users(student_id) ON DELETE CASCADE,
        money INTEGER DEFAULT 1,
        probability INTEGER DEFAULT 100,
        total_attempts INTEGER DEFAULT 0,
        successes INTEGER DEFAULT 0,
        failures INTEGER DEFAULT 0,
        best_record INTEGER DEFAULT 1,
        remaining_attempts INTEGER DEFAULT 5,
        recent_history JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ 데이터베이스 테이블 초기화 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
  }
};

initDB();

// ===== API 엔드포인트 =====

// 1. 로그인 / 회원가입
app.post('/api/login', async (req, res) => {
  const { studentId } = req.body;

  if (!studentId || !studentId.trim()) {
    return res.status(400).json({ success: false, message: '학번을 입력해주세요.' });
  }

  const trimmedId = studentId.trim();
  const isTeacher = trimmedId.toLowerCase() === 'teacher';

  try {
    // 사용자 확인 또는 생성
    let userResult = await pool.query(
      'SELECT * FROM users WHERE student_id = $1',
      [trimmedId]
    );

    if (userResult.rows.length === 0) {
      // 신규 사용자 생성
      await pool.query(
        'INSERT INTO users (student_id, is_teacher) VALUES ($1, $2)',
        [trimmedId, isTeacher]
      );

      // 게임 상태 초기화
      await pool.query(
        `INSERT INTO game_states (student_id, remaining_attempts) 
         VALUES ($1, $2)`,
        [trimmedId, isTeacher ? 999 : 5]
      );
    }

    // 게임 상태 조회
    const gameResult = await pool.query(
      'SELECT * FROM game_states WHERE student_id = $1',
      [trimmedId]
    );

    const gameState = gameResult.rows[0];

    res.json({
      success: true,
      isTeacher,
      remainingAttempts: isTeacher ? 999 : gameState.remaining_attempts,
      gameState: {
        money: gameState.money,
        probability: gameState.probability,
        totalAttempts: gameState.total_attempts,
        successes: gameState.successes,
        failures: gameState.failures,
        bestRecord: gameState.best_record,
        recentHistory: gameState.recent_history
      }
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 2. 게임 상태 저장
app.post('/api/save', async (req, res) => {
  const { studentId, gameState, remainingAttempts } = req.body;

  if (!studentId) {
    return res.status(400).json({ success: false, message: '학번이 필요합니다.' });
  }

  try {
    await pool.query(
      `UPDATE game_states 
       SET money = $1, 
           probability = $2, 
           total_attempts = $3, 
           successes = $4, 
           failures = $5, 
           best_record = $6, 
           remaining_attempts = $7,
           recent_history = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $9`,
      [
        gameState.money,
        gameState.probability,
        gameState.totalAttempts,
        gameState.successes,
        gameState.failures,
        gameState.bestRecord,
        remainingAttempts,
        JSON.stringify(gameState.recentHistory),
        studentId
      ]
    );

    res.json({ success: true, message: '저장 완료' });
  } catch (error) {
    console.error('저장 오류:', error);
    res.status(500).json({ success: false, message: '저장 실패' });
  }
});

// 3. 게임 상태 조회
app.get('/api/game-state/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM game_states WHERE student_id = $1',
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const gameState = result.rows[0];
    res.json({
      success: true,
      gameState: {
        money: gameState.money,
        probability: gameState.probability,
        totalAttempts: gameState.total_attempts,
        successes: gameState.successes,
        failures: gameState.failures,
        bestRecord: gameState.best_record,
        remainingAttempts: gameState.remaining_attempts,
        recentHistory: gameState.recent_history
      }
    });
  } catch (error) {
    console.error('조회 오류:', error);
    res.status(500).json({ success: false, message: '조회 실패' });
  }
});

// 4. 전체 리더보드 조회 (선택사항)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.student_id, u.is_teacher, g.best_record, g.total_attempts, g.successes
       FROM users u
       JOIN game_states g ON u.student_id = g.student_id
       ORDER BY g.best_record DESC
       LIMIT 10`
    );

    res.json({ success: true, leaderboard: result.rows });
  } catch (error) {
    console.error('리더보드 조회 오류:', error);
    res.status(500).json({ success: false, message: '조회 실패' });
  }
});

// 5. 사용자 데이터 초기화
app.post('/api/reset/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const userResult = await pool.query(
      'SELECT is_teacher FROM users WHERE student_id = $1',
      [studentId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const isTeacher = userResult.rows[0].is_teacher;

    await pool.query(
      `UPDATE game_states 
       SET money = 1,
           probability = 100,
           total_attempts = 0,
           successes = 0,
           failures = 0,
           best_record = 1,
           remaining_attempts = $1,
           recent_history = '[]',
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $2`,
      [isTeacher ? 999 : 5, studentId]
    );

    res.json({ success: true, message: '초기화 완료' });
  } catch (error) {
    console.error('초기화 오류:', error);
    res.status(500).json({ success: false, message: '초기화 실패' });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});