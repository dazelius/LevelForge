/**
 * FPS 레벨 디자인 규칙
 * 프로시저럴 생성 시 이 규칙들을 참조합니다.
 */

const LevelRules = {
    // ========== 기본 상수 ==========
    PLAYER_SPEED: 4.5,          // 플레이어 이동 속도 (m/s)
    GRID_SIZE: 32,              // 1그리드 = 1m (픽셀)
    
    // ========== 스폰 규칙 ==========
    // "Defence Spawn과 Offence Spawn은 반드시 하나씩 존재해야 한다"
    // "모든 경로는 여기서 파생된다"
    SPAWN: {
        required: true,         // 필수 여부
        count: {
            defence: 1,         // Defence Spawn 개수 (정확히 1개)
            offence: 1          // Offence Spawn 개수 (정확히 1개)
        },
        size: 10,               // 스폰 영역 크기 (m) - 10x10
        
        get sizePx() { return this.size * LevelRules.GRID_SIZE; },  // 320px
        
        // 스폰은 경로의 시작점
        isPathOrigin: true,
        
        description: "Defence/Offence Spawn은 각각 1개, 10x10m 영역. 모든 경로의 시작점"
    },
    
    // ========== 거점(목표) 규칙 ==========
    // "점령해야 하는 목표 지점이 반드시 하나 존재해야 한다"
    OBJECTIVE: {
        required: true,         // 필수 여부
        count: 1,               // 거점 개수 (정확히 1개)
        size: 16,               // 거점 영역 크기 (m) - 16x16
        
        get sizePx() { return this.size * LevelRules.GRID_SIZE; },  // 512px
        
        description: "점령 목표 거점 1개, 16x16m 영역"
    },
    
    // ========== 스폰-목표 거리 규칙 ==========
    // "스폰과 목표 사이 최소 거리"
    DISTANCE: {
        offenceToObjective: 50,     // Offence → Objective 최소 거리 (m)
        defenceToObjective: 25,     // Defence → Objective 최소 거리 (m)
        
        get offenceToObjectivePx() { return this.offenceToObjective * LevelRules.GRID_SIZE; },  // 1600px
        get defenceToObjectivePx() { return this.defenceToObjective * LevelRules.GRID_SIZE; },  // 800px
        
        description: "Offence는 목표에서 50m 이상, Defence는 25m 이상 떨어져야 함"
    },
    
    // ========== 경로(PATH) 규칙 ==========
    // "Offence에서 Objective로 가는 경로는 최소 2개 이상"
    PATH: {
        offenceToObjective: {
            minPaths: 2,            // 최소 경로 수
            description: "Offence → Objective 경로는 최소 2개 (우회로 필수)"
        },
        defenceToObjective: {
            minPaths: 1,            // 최소 경로 수
            description: "Defence → Objective 경로는 최소 1개"
        },
        // 중간 경유지 (Junction Node)
        junctionNode: {
            enabled: true,          // 경유지 사용 여부
            minSize: 8,             // 경유지 최소 크기 (m)
            get minSizePx() { return this.minSize * LevelRules.GRID_SIZE; },
            description: "경로 분기를 위한 중간 노드 (8x8m 이상)"
        },
        description: "공격팀은 최소 2개 이상의 경로로 목표에 접근 가능해야 함"
    },
    
    // ========== 3초 룰 ==========
    // "같은 방향으로 3초간 달리면 방향을 틀 수 있어야 한다"
    THREE_SECOND_RULE: {
        time: 3,                                    // 초
        get maxStraightDistance() {                 // 최대 직선 거리
            return LevelRules.PLAYER_SPEED * this.time;  // 13.5m
        },
        get maxStraightPixels() {
            return this.maxStraightDistance * LevelRules.GRID_SIZE;  // 432px
        },
        description: "3초 이상 직선으로 달리면 코너나 분기점이 있어야 함"
    },
    
    // ========== 3방향 룰 ==========
    // "매 지점마다 이동/후퇴/우회를 할 수 있는 루트"
    THREE_ROUTE_RULE: {
        minRoutes: 3,           // 최소 경로 수
        routes: {
            advance: "전진 - 목표를 향해 진행",
            retreat: "후퇴 - 안전하게 물러남", 
            flank: "우회 - 측면으로 돌아감"
        },
        description: "모든 주요 지점에서 최소 3방향 선택지"
    },
    
    // ========== 통로 규격 ==========
    CORRIDOR: {
        minWidth: 4,            // 최소 폭 (m)
        standardWidth: 5,       // 표준 폭 (m)
        maxWidth: 6,            // 최대 폭 (m) - 초과 시 공간으로 분류
        wallThickness: 1,       // 벽 두께 (m)
        
        get minWidthPx() { return this.minWidth * LevelRules.GRID_SIZE; },   // 128px
        get standardWidthPx() { return this.standardWidth * LevelRules.GRID_SIZE; },  // 160px
        get maxWidthPx() { return this.maxWidth * LevelRules.GRID_SIZE; },   // 192px
        get wallThicknessPx() { return this.wallThickness * LevelRules.GRID_SIZE; },
        
        description: "통로 폭: 최소 4m ~ 최대 6m"
    },
    
    // ========== 분기점 규격 ==========
    JUNCTION: {
        minSize: 8,             // 최소 크기 (m) - 3방향 분기 가능
        standardSize: 10,       // 표준 크기 (m)
        
        get minSizePx() { return this.minSize * LevelRules.GRID_SIZE; },
        get standardSizePx() { return this.standardSize * LevelRules.GRID_SIZE; }
    },
    
    // ========== 고저차 ==========
    ELEVATION: {
        stepHeight: 0.5,        // 계단 높이 (m)
        maxRampAngle: 30,       // 최대 경사 각도
        tacticalAdvantage: 2,   // 전술적 고지 (m) - 이 이상 높으면 유리
        
        rampLength(heightDiff) {
            // 경사로 길이 계산 (30도 기준)
            return Math.abs(heightDiff) / Math.tan(this.maxRampAngle * Math.PI / 180);
        }
    },
    
    // ========== 시야선 ==========
    SIGHTLINE: {
        shortRange: 10,         // 근거리 (m) - SMG, 샷건
        midRange: 25,           // 중거리 (m) - AR
        longRange: 50,          // 장거리 (m) - 스나이퍼
        
        // 권장: 대부분의 시야선은 중거리 이하
        recommendedMax: 25,
        
        description: "긴 직선 통로는 저격에 유리 - 코너로 시야선 차단"
    },
    
    // ========== 전투 공간 ==========
    COMBAT_SPACE: {
        minSize: 10,            // 최소 전투 공간 (m)
        standardSize: 15,       // 표준 전투 공간 (m)
        
        // 공간 유형
        types: {
            choke: { width: 4, description: "병목 - 좁은 통과점" },
            arena: { minSize: 15, description: "아레나 - 넓은 교전 구역" },
            objective: { minSize: 16, description: "목표 지점 - 공방 균형" }
        }
    },
    
    // ========== 규칙 검증 함수들 ==========
    validate: {
        // 스폰 규칙 검증: Defence/Offence Spawn이 각각 1개씩 있는지
        checkSpawnRule(objects) {
            const defSpawns = objects.filter(o => o.type === 'spawn-def').length;
            const offSpawns = objects.filter(o => o.type === 'spawn-off').length;
            const reqDef = LevelRules.SPAWN.count.defence;
            const reqOff = LevelRules.SPAWN.count.offence;
            
            const issues = [];
            if (defSpawns !== reqDef) issues.push(`Defence Spawn: ${defSpawns}개 (필요: ${reqDef}개)`);
            if (offSpawns !== reqOff) issues.push(`Offence Spawn: ${offSpawns}개 (필요: ${reqOff}개)`);
            
            return {
                valid: defSpawns === reqDef && offSpawns === reqOff,
                defenceCount: defSpawns,
                offenceCount: offSpawns,
                message: issues.length ? issues.join(', ') : 'OK'
            };
        },
        
        // 거점 규칙 검증: Objective가 1개 있는지
        checkObjectiveRule(objects) {
            const objectives = objects.filter(o => o.type === 'objective').length;
            const required = LevelRules.OBJECTIVE.count;
            
            return {
                valid: objectives === required,
                count: objectives,
                message: objectives !== required
                    ? `거점: ${objectives}개 (필요: ${required}개)`
                    : 'OK'
            };
        },
        
        // 스폰-목표 거리 검증
        checkDistanceRule(objects) {
            const objective = objects.find(o => o.type === 'objective');
            const defSpawn = objects.find(o => o.type === 'spawn-def');
            const offSpawn = objects.find(o => o.type === 'spawn-off');
            
            if (!objective || !defSpawn || !offSpawn) {
                return { valid: false, message: '스폰 또는 목표가 없음' };
            }
            
            // 중심점 계산
            const objCenter = { 
                x: objective.x + (objective.width || 0) / 2, 
                y: objective.y + (objective.height || 0) / 2 
            };
            const defCenter = { 
                x: defSpawn.x + (defSpawn.width || 0) / 2, 
                y: defSpawn.y + (defSpawn.height || 0) / 2 
            };
            const offCenter = { 
                x: offSpawn.x + (offSpawn.width || 0) / 2, 
                y: offSpawn.y + (offSpawn.height || 0) / 2 
            };
            
            // 거리 계산 (픽셀)
            const defDist = Math.sqrt(Math.pow(objCenter.x - defCenter.x, 2) + Math.pow(objCenter.y - defCenter.y, 2));
            const offDist = Math.sqrt(Math.pow(objCenter.x - offCenter.x, 2) + Math.pow(objCenter.y - offCenter.y, 2));
            
            const minDefDist = LevelRules.DISTANCE.defenceToObjectivePx;
            const minOffDist = LevelRules.DISTANCE.offenceToObjectivePx;
            
            const issues = [];
            if (defDist < minDefDist) {
                issues.push(`Defence→목표: ${Math.round(defDist/32)}m < 최소 ${LevelRules.DISTANCE.defenceToObjective}m`);
            }
            if (offDist < minOffDist) {
                issues.push(`Offence→목표: ${Math.round(offDist/32)}m < 최소 ${LevelRules.DISTANCE.offenceToObjective}m`);
            }
            
            return {
                valid: issues.length === 0,
                defenceDistance: Math.round(defDist / 32),
                offenceDistance: Math.round(offDist / 32),
                message: issues.length ? issues.join(', ') : 'OK'
            };
        },
        
        // 3초 룰 검증: 직선 거리가 너무 긴지
        checkThreeSecondRule(corridorLength) {
            const max = LevelRules.THREE_SECOND_RULE.maxStraightPixels;
            return {
                valid: corridorLength <= max,
                message: corridorLength > max 
                    ? `직선 ${Math.round(corridorLength/32)}m > 최대 ${Math.round(max/32)}m (3초 룰 위반)`
                    : 'OK'
            };
        },
        
        // 3방향 룰 검증: 연결점이 충분한지
        checkThreeRouteRule(connectionCount) {
            const min = LevelRules.THREE_ROUTE_RULE.minRoutes;
            return {
                valid: connectionCount >= min,
                message: connectionCount < min
                    ? `연결점 ${connectionCount}개 < 최소 ${min}개 (3방향 룰 위반)`
                    : 'OK'
            };
        },
        
        // 통로 폭 검증 (최소 4m ~ 최대 6m)
        checkCorridorWidth(width) {
            const min = LevelRules.CORRIDOR.minWidthPx;
            const max = LevelRules.CORRIDOR.maxWidthPx;
            const widthM = Math.round(width / 32);
            
            const issues = [];
            if (width < min) {
                issues.push(`통로 폭 ${widthM}m < 최소 ${LevelRules.CORRIDOR.minWidth}m`);
            }
            if (width > max) {
                issues.push(`통로 폭 ${widthM}m > 최대 ${LevelRules.CORRIDOR.maxWidth}m (공간으로 분류)`);
            }
            
            return {
                valid: width >= min && width <= max,
                widthMeters: widthM,
                message: issues.length ? issues.join(', ') : 'OK'
            };
        },
        
        // 경로 규칙 검증: Offence→Objective 경로가 최소 2개 이상인지
        // (실제 경로 분석은 복잡하므로 여기서는 junction 노드 수로 추정)
        checkPathRule(objects) {
            const junctions = objects.filter(o => 
                o.type === 'floor-area' && 
                o.label && o.label.includes('Junction')
            ).length;
            
            const minPaths = LevelRules.PATH.offenceToObjective.minPaths;
            
            // junction이 있으면 경로가 분기됨
            const estimatedPaths = junctions > 0 ? junctions + 1 : 1;
            
            return {
                valid: estimatedPaths >= minPaths,
                junctionCount: junctions,
                estimatedPaths: estimatedPaths,
                message: estimatedPaths < minPaths
                    ? `경로 ${estimatedPaths}개 < 최소 ${minPaths}개 (우회로 필요)`
                    : 'OK'
            };
        },
        
        // 전체 맵 검증
        checkAll(objects) {
            const results = {
                spawn: this.checkSpawnRule(objects),
                objective: this.checkObjectiveRule(objects),
                distance: this.checkDistanceRule(objects),
                path: this.checkPathRule(objects),
                // 추가 검증은 여기에
            };
            
            const allValid = Object.values(results).every(r => r.valid);
            return { valid: allValid, results };
        }
    }
};

// 전역으로 노출
window.LevelRules = LevelRules;
