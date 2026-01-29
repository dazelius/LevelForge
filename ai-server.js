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

// JSON 추출 함수
function extractJSON(text) {
    // 1. 코드블록 제거
    let cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // 2. 직접 파싱
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.objects) return parsed;
    } catch (e) {}
    
    // 3. { 부터 } 까지 중첩 매칭
    let depth = 0, start = -1, end = -1;
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (cleaned[i] === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                end = i + 1;
                try {
                    const parsed = JSON.parse(cleaned.substring(start, end));
                    if (parsed.objects) return parsed;
                } catch (e) {}
                start = -1; // 다음 블록 시도
            }
        }
    }
    
    // 4. "objects" 배열만 추출
    const arrMatch = cleaned.match(/"objects"\s*:\s*\[([\s\S]*?)\]/);
    if (arrMatch) {
        try {
            const arr = JSON.parse('[' + arrMatch[1] + ']');
            return { objects: arr, description: "AI 생성" };
        } catch (e) {}
    }
    
    return null;
}

// Claude API 호출
async function callClaude(prompt, levelData) {
    const systemPrompt = `You are a JSON generator for FPS level design. Output ONLY valid JSON, no text.

FORMAT (output exactly this structure):
{"objects":[{"type":"polyfloor","points":[{"x":0,"y":0,"z":0},{"x":128,"y":0,"z":0},{"x":128,"y":128,"z":0},{"x":0,"y":128,"z":0}],"floorHeight":0,"floor":0,"label":"name","closed":true}],"description":"what was created"}

RULES:
- 32px = 1m
- Corridor width: 128-192px
- Match existing vertex coordinates exactly
- Output ONLY JSON, no explanation, no markdown`;

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
                content: `Level: ${JSON.stringify(levelData)}\n\nTask: ${prompt}\n\nRespond with ONLY the JSON object. No other text.`
            }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    
    console.log('📥 AI 원본 응답:', text.substring(0, 200) + '...');
    
    // JSON 추출
    const extracted = extractJSON(text);
    if (extracted && extracted.objects && extracted.objects.length > 0) {
        console.log('✅ JSON 추출 성공:', extracted.objects.length, '개 오브젝트');
        return JSON.stringify(extracted);
    }
    
    console.log('⚠️ JSON 추출 실패, 원본 반환');
    return text;
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
