-- 1. 학생 테이블
CREATE TABLE students (
    student_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 게임 기록 테이블
CREATE TABLE game_records (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(10) NOT NULL,
    is_teacher BOOLEAN DEFAULT FALSE,
    remaining_attempts INTEGER DEFAULT 1,
    total_attempts INTEGER DEFAULT 0,
    current_money INTEGER DEFAULT 1,
    current_probability INTEGER DEFAULT 100,
    successes INTEGER DEFAULT 0,
    failures INTEGER DEFAULT 0,
    best_record INTEGER DEFAULT 1,
    recent_history JSONB DEFAULT '[]'::jsonb,
    last_played_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 3. 선생님 계정 테이블 (또는 단순히 game_records에서 is_teacher로 구분)
CREATE TABLE teachers (
    teacher_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX idx_game_records_student_id ON game_records(student_id);
CREATE INDEX idx_game_records_best_record ON game_records(best_record DESC);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_records_updated_at 
    BEFORE UPDATE ON game_records 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();