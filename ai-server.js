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
    const systemPrompt = `당신은 FPS 게임 레벨 디자인 전문가입니다. LEVELFORGE 도구를 사용하여 레벨을 설계하고 있습니다.

현재 레벨 데이터 구조:
- objects: 오브젝트 배열 (polyfloor, spawn-def, spawn-off, objective 등)
- polyfloor: { id, type: "polyfloor", points: [{x, y, z}...], floorHeight, label }
- spawn-def: Defence 스폰 지점 (10x10m)
- spawn-off: Offence 스폰 지점 (10x10m)  
- objective: 점령 목표 지점 (16x16m)

좌표 단위: 1 그리드 = 32px = 1m
높이(z): 미터 단위

레벨 디자인 원칙:
1. 3초 룰: 같은 방향으로 3초간 달리면 방향을 틀 수 있어야 함 (이동속도 5m/s 기준 15m)
2. 초크포인트: 양 팀이 만나는 교전 지점 필요
3. 다양한 루트: Offence에서 Objective로 가는 경로가 2개 이상
4. 커버 배치: 이동 경로에 엄폐물 필요
5. 사이트라인: 긴 사이트라인과 짧은 교전 거리 균형

응답 시 JSON 형식으로 새 오브젝트를 제안하거나, 텍스트로 조언을 제공하세요.`;

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
