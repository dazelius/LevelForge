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
    const systemPrompt = `당신은 FPS 게임 레벨 디자인 AI입니다. polyfloor 오브젝트를 JSON으로 생성합니다.

## 좌표: 32px = 1m, z는 높이(미터)

## 반드시 이 형식으로만 응답하세요:
{"objects":[{"type":"polyfloor","points":[{"x":0,"y":0,"z":0},{"x":128,"y":0,"z":0},{"x":128,"y":128,"z":0},{"x":0,"y":128,"z":0}],"floorHeight":0,"floor":0,"label":"이름","closed":true}],"description":"설명"}

## 규칙:
- 통로 폭: 128~192px (4~6m)
- points는 최소 3개, 시계/반시계 순서
- 기존 바닥 좌표와 정확히 일치시켜 연결
- 설명이나 마크다운 없이 JSON만 출력`;

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
                content: `레벨 데이터: ${JSON.stringify(levelData)}\n\n요청: ${prompt}\n\n위 형식의 JSON만 응답하세요. 설명 없이 JSON만.`
            }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API 오류: ${response.status} - ${error}`);
    }

    const data = await response.json();
    let text = data.content[0].text;
    
    // JSON 추출 시도
    try {
        // 코드블록 제거
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        // 앞뒤 공백/줄바꿈 제거
        text = text.trim();
        // JSON 파싱 테스트
        const parsed = JSON.parse(text);
        if (parsed.objects && Array.isArray(parsed.objects)) {
            return JSON.stringify(parsed); // 깨끗한 JSON 반환
        }
    } catch (e) {
        // JSON 블록 찾기
        const match = text.match(/\{[\s\S]*"objects"[\s\S]*\}/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                if (parsed.objects) {
                    return JSON.stringify(parsed);
                }
            } catch (e2) {}
        }
    }
    
    return text; // 원본 반환
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
