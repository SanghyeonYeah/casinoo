const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL 연결 풀 생성
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    // 연결 풀 설정
    max: 20, // 최대 연결 수
    idleTimeoutMillis: 30000, // 유휴 연결 타임아웃
    connectionTimeoutMillis: 2000, // 연결 타임아웃
});

// 연결 테스트
pool.on('connect', () => {
    console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(-1);
});

// 데이터베이스 쿼리 함수들
const db = {
    // 쿼리 실행
    query: (text, params) => pool.query(text, params),

    // 트랜잭션 시작
    getClient: () => pool.connect(),

    // ==================== 학생 관련 ====================
    
    // 학생 추가 또는 업데이트
    async upsertStudent(studentId, name) {
        const query = `
            INSERT INTO students (student_id, name) 
            VALUES ($1, $2) 
            ON CONFLICT (student_id) 
            DO UPDATE SET name = $2
            RETURNING *
        `;
        const result = await pool.query(query, [studentId, name]);
        return result.rows[0];
    },

    // 학생 조회
    async getStudent(studentId) {
        const query = 'SELECT * FROM students WHERE student_id = $1';
        const result = await pool.query(query, [studentId]);
        return result.rows[0];
    },

    // ==================== 선생님 관련 ====================
    
    // 선생님 추가
    async upsertTeacher(teacherId, name) {
        const query = `
            INSERT INTO teachers (teacher_id, name) 
            VALUES ($1, $2) 
            ON CONFLICT (teacher_id) 
            DO NOTHING
            RETURNING *
        `;
        const result = await pool.query(query, [teacherId, name]);
        return result.rows[0];
    },

    // 선생님 확인
    async isTeacher(teacherId) {
        const query = 'SELECT * FROM teachers WHERE teacher_id = $1';
        const result = await pool.query(query, [teacherId]);
        return result.rows.length > 0;
    },

    // ==================== 게임 기록 관련 ====================
    
    // 게임 기록 조회
    async getGameRecord(studentId) {
        const query = 'SELECT * FROM game_records WHERE student_id = $1';
        const result = await pool.query(query, [studentId]);
        return result.rows[0];
    },

    // 게임 기록 생성
    async createGameRecord(studentId, isTeacher) {
        const query = `
            INSERT INTO game_records 
            (student_id, is_teacher, remaining_attempts, current_money, current_probability) 
            VALUES ($1, $2, $3, 100, 100) 
            RETURNING *
        `;
        const attempts = isTeacher ? 999999 : 5;
        const result = await pool.query(query, [studentId, isTeacher, attempts]);
        return result.rows[0];
    },

    // 게임 기록 업데이트 (선생님 권한 부여)
    async updateTeacherStatus(studentId, isTeacher) {
        const query = `
            UPDATE game_records 
            SET is_teacher = $2, remaining_attempts = $3 
            WHERE student_id = $1 
            RETURNING *
        `;
        const attempts = isTeacher ? 999999 : 5;
        const result = await pool.query(query, [studentId, isTeacher, attempts]);
        return result.rows[0];
    },

    // 게임 플레이 결과 업데이트
    async updateGameResult(studentId, data) {
        const {
            remainingAttempts,
            newMoney,
            newProbability,
            success,
            bestRecord,
            recentHistory
        } = data;

        const query = `
            UPDATE game_records SET 
                remaining_attempts = $1,
                total_attempts = total_attempts + 1,
                current_money = $2,
                current_probability = $3,
                successes = successes + $4,
                failures = failures + $5,
                best_record = $6,
                recent_history = $7,
                last_played_at = NOW()
            WHERE student_id = $8
            RETURNING *
        `;

        const result = await pool.query(query, [
            remainingAttempts,
            newMoney,
            newProbability,
            success ? 1 : 0,
            success ? 0 : 1,
            bestRecord,
            JSON.stringify(recentHistory),
            studentId
        ]);

        return result.rows[0];
    },

    // 통계 조회
    async getStats(studentId) {
        const query = `
            SELECT 
                total_attempts, 
                successes, 
                failures, 
                best_record 
            FROM game_records 
            WHERE student_id = $1
        `;
        const result = await pool.query(query, [studentId]);
        return result.rows[0] || {
            total_attempts: 0,
            successes: 0,
            failures: 0,
            best_record: 100
        };
    },

    // 최근 기록 조회
    async getRecentHistory(studentId) {
        const query = 'SELECT recent_history FROM game_records WHERE student_id = $1';
        const result = await pool.query(query, [studentId]);
        return result.rows[0]?.recent_history || [];
    },

    // 랭킹 조회 (상위 10명)
    async getRanking(limit = 10) {
        const query = `
            SELECT 
                s.student_id, 
                s.name, 
                g.best_record,
                g.total_attempts,
                g.successes
            FROM game_records g 
            JOIN students s ON g.student_id = s.student_id 
            WHERE g.best_record > 100
            ORDER BY g.best_record DESC, g.total_attempts ASC
            LIMIT $1
        `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    },

    // 전체 통계 (관리자용)
    async getGlobalStats() {
        const query = `
            SELECT 
                COUNT(DISTINCT student_id) as total_players,
                SUM(total_attempts) as total_games,
                SUM(successes) as total_successes,
                SUM(failures) as total_failures,
                MAX(best_record) as highest_record,
                AVG(best_record) as average_record
            FROM game_records
        `;
        const result = await pool.query(query);
        return result.rows[0];
    },

    // ==================== 유틸리티 ====================
    
    // 게임 기록 초기화 (특정 학생)
    async resetGameRecord(studentId) {
        const query = `
            UPDATE game_records 
            SET 
                remaining_attempts = CASE WHEN is_teacher THEN 999999 ELSE 5 END,
                current_money = 100,
                current_probability = 100,
                total_attempts = 0,
                successes = 0,
                failures = 0,
                best_record = 100,
                recent_history = '[]'::jsonb,
                last_played_at = NULL
            WHERE student_id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [studentId]);
        return result.rows[0];
    },

    // 기회 충전 (관리자용)
    async refillAttempts(studentId, attempts = 5) {
        const query = `
            UPDATE game_records 
            SET remaining_attempts = remaining_attempts + $2 
            WHERE student_id = $1 
            RETURNING *
        `;
        const result = await pool.query(query, [studentId, attempts]);
        return result.rows[0];
    },

    // 데이터베이스 연결 종료
    async close() {
        await pool.end();
        console.log('✅ Database connection closed');
    },

    // 연결 상태 확인
    async checkConnection() {
        try {
            const result = await pool.query('SELECT NOW()');
            return { success: true, time: result.rows[0].now };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// 프로세스 종료 시 연결 정리
process.on('SIGINT', async () => {
    await db.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await db.close();
    process.exit(0);
});

module.exports = db;