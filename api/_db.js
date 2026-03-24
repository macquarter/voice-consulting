const { sql } = require('@vercel/postgres');

const TABLES = {
  bookings: `
    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(200) NOT NULL,
      phone VARCHAR(30),
      course VARCHAR(100) NOT NULL,
      date VARCHAR(20) NOT NULL,
      time VARCHAR(10) NOT NULL,
      message TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      memo TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `,
  courses: `
    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      duration VARCHAR(50),
      price INTEGER,
      description TEXT,
      features TEXT,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true
    )
  `,
  content: `
    CREATE TABLE IF NOT EXISTS site_content (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `,
  testimonials: `
    CREATE TABLE IF NOT EXISTS testimonials (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(100),
      content TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
};

const DEFAULT_COURSES = [
  { name: '1일 집중 과정', duration: '1일 (3시간)', price: 300000, description: '핵심 문제 진단 및 즉각 개선. 바쁜 분들을 위한 압축 코스.', features: '음성 진단,핵심 교정,녹화본 제공', sort_order: 1 },
  { name: '4주 기본 과정', duration: '4주 (주 1회)', price: 800000, description: '체계적인 목소리 변화의 시작. 기본기부터 탄탄하게.', features: '주간 1:1 화상,맞춤 커리큘럼,매회 녹화본,중간 평가', sort_order: 2 },
  { name: '9주 심화 과정', duration: '9주 (주 1회)', price: 1500000, description: '완벽한 보이스 브랜딩. 프로페셔널 스피커로 거듭나기.', features: '주간 1:1 화상,완전 맞춤형,전 과정 녹화본,수시 피드백,수료 인증', sort_order: 3 }
];

const DEFAULT_CONTENT = {
  hero_title: '인공지능과 경쟁하는 시대,\n당신의 무기는 무엇입니까?',
  hero_subtitle: '기계가 정답을 내놓는 세상,\n사람의 마음을 얻는 유일한 열쇠는 \'사람\'입니다.',
  hero_cta: '나만의 목소리 무기 만들기',
  expert_name: '손수오',
  expert_title: '대한민국 No.1 보이스 컨설턴트',
  expert_intro: '단 한 문장으로 7가지 문제점을 해결하는 38 효과를 직접 경험하십시오.',
  footer_text: '© 2024 손수오 보이스 컨설팅. All rights reserved.'
};

const DEFAULT_TESTIMONIALS = [
  { name: '김○○ 대표', role: 'IT 스타트업 CEO', content: '투자 발표 때마다 떨렸는데, 9주 과정 후 투자자들이 먼저 연락해왔습니다. 목소리가 달라지니 자신감이 완전히 바뀌었어요.', rating: 5 },
  { name: '이○○ 팀장', role: '대기업 마케팅', content: '프레젠테이션 공포증이 있었는데, 4주만에 팀 발표를 자원하게 되었습니다. 동료들이 놀라더군요.', rating: 5 },
  { name: '박○○ 아나운서', role: '방송인', content: '현업에서 10년 했지만 손수오 교수님께 배운 38 효과는 정말 혁신적이었습니다. 시청자 반응이 확 달라졌어요.', rating: 5 }
];

module.exports = { sql, TABLES, DEFAULT_COURSES, DEFAULT_CONTENT, DEFAULT_TESTIMONIALS };
