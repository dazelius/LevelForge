/**
 * LEVELFORGE AI Assistant Server
 * Claude API를 사용한 레벨 디자인 어시스턴트
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// .env 파일에서 API 키 로드
let ANTHROPIC_API_KEY = '';
try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
    if (match) {
        ANTHROPIC_API_KEY = match[1].trim();
    }
} catch (err) {
    console.error('⚠️ .env 파일을 찾을 수 없습니다. API 키를 설정해주세요.');
}

const PORT = 3001;

// Claude API 호출
async function callClaude(prompt, levelData) {
    const systemPrompt = `당신은 FPS 게임 레벨 디자인 전문가이자 레벨 에디터입니다. 사용자의 요청에 따라 실제로 맵을 수정합니다.

## 좌표 시스템
- 1 그리드 = 32px = 1m
- x: 오른쪽이 양수, y: 아래쪽이 양수
- z (높이): 미터 단위, 0이 기본

## 오브젝트 구조
polyfloor (바닥):
{
  "type": "polyfloor",
  "points": [{"x": 0, "y": 0, "z": 0}, {"x": 160, "y": 0, "z": 0}, ...],
  "floorHeight": 0,
  "floor": 0,
  "label": "통로A",
  "category": "floors",
  "color": "hsla(200, 60%, 40%, 0.6)",
  "closed": true
}

## 중요 규칙
1. 통로 너비: 최소 4m(128px) ~ 6m(192px)
2. 기존 바닥과 연결 시: 기존 점(vertex)과 정확히 일치하도록 좌표 맞추기
3. 다각형은 시계방향 또는 반시계방향으로 점 배열
4. 접합부는 공유하는 변(edge)의 점들이 정확히 일치해야 함

## 레벨 디자인 원칙
- 3초 룰: 15m마다 방향 전환 가능
- 다양한 루트: 최소 2개 이상의 경로
- 초크포인트: 양 팀이 만나는 교전 지점

## 응답 형식
반드시 다음 JSON 형식으로 새로 생성할 오브젝트를 제공하세요:

\`\`\`json
{
  "objects": [
    {
      "type": "polyfloor",
      "points": [...],
      "floorHeight": 0,
      "floor": 0,
      "label": "이름",
      "category": "floors",
      "color": "hsla(200, 60%, 40%, 0.6)",
      "closed": true
    }
  ],
  "description": "무엇을 만들었는지 설명"
}
\`\`\`

기존 바닥들과 자연스럽게 연결되도록 좌표를 계산하세요.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{
                role: 'user',
                content: `현재 레벨 데이터:\n${JSON.stringify(levelData, null, 2)}\n\n요청: ${prompt}`
            }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API 오류: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// HTTP 서버
const server = http.createServer(async (req, res) => {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/ai/chat') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { prompt, levelData } = JSON.parse(body);
                
                if (!ANTHROPIC_API_KEY) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }));
                    return;
                }

                console.log(`🤖 AI 요청: ${prompt.substring(0, 50)}...`);
                const response = await callClaude(prompt, levelData);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response }));
            } catch (err) {
                console.error('❌ AI 오류:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n🤖 LEVELFORGE AI Assistant`);
    console.log(`   서버 실행 중: http://localhost:${PORT}`);
    console.log(`   API 키: ${ANTHROPIC_API_KEY ? '✅ 설정됨' : '❌ 없음'}\n`);
});
