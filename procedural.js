/**
 * LEVELFORGE - Procedural Level Generation
 * 프로시저럴 레벨 생성 모듈
 */

class ProceduralGenerator {
    constructor(app) {
        this.app = app;  // LevelForge 인스턴스 참조
    }
    
    // 헬퍼: objects 접근
    get objects() {
        return this.app.objects;
    }
    
    get nextId() {
        return this.app.nextId++;
    }
    
    get currentFloor() {
        return this.app.currentFloor;
    }
    
    // ========== 헬퍼: 모든 바닥 가져오기 (polyfloor + floor-area + markers) ==========
    
    getAllFloors() {
        const floors = [];
        const floorTypes = ['polyfloor', 'floor-area', 'spawn-def', 'spawn-off', 'objective'];
        
        this.objects.forEach(o => {
            if (o.type === 'polyfloor' && o.points?.length >= 3) {
                floors.push(o);
            } else if (floorTypes.includes(o.type) && o.width && o.height) {
                // 사각형 영역을 points 형태로 변환
                const pts = [
                    { x: o.x, y: o.y, z: 0 },
                    { x: o.x + o.width, y: o.y, z: 0 },
                    { x: o.x + o.width, y: o.y + o.height, z: 0 },
                    { x: o.x, y: o.y + o.height, z: 0 }
                ];
                floors.push({
                    ...o,
                    points: pts,
                    _isMarker: ['spawn-def', 'spawn-off', 'objective'].includes(o.type)
                });
            }
        });
        
        return floors;
    }
    
    // ========== Step 1: 스폰/Objective 위치 파악 ==========
    
    findSpawnsAndObjective() {
        const defence = this.objects.find(o => o.type === 'spawn-def');
        const offence = this.objects.find(o => o.type === 'spawn-off');
        const objective = this.objects.find(o => o.type === 'objective');
        return { defence, offence, objective };
    }
    
    findFloorContainingPoint(x, y) {
        const floors = this.getAllFloors();
        return floors.find(floor => this.app.isPointInPolygon(x, y, floor.points));
    }
    
    findFloorNearPoint(x, y, maxDist = 500) {
        const floors = this.getAllFloors();
        let closest = null;
        let minDist = maxDist;
        
        floors.forEach(floor => {
            const cx = floor.points.reduce((s, p) => s + p.x, 0) / floor.points.length;
            const cy = floor.points.reduce((s, p) => s + p.y, 0) / floor.points.length;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            
            if (dist < minDist) {
                minDist = dist;
                closest = floor;
            }
        });
        
        return closest;
    }
    
    // ========== Step 2: 바닥 연결 그래프 생성 ==========
    
    buildConnectionGraph(tolerance = 16) {
        const floors = this.getAllFloors();
        const graph = new Map();
        
        floors.forEach(floor => {
            graph.set(floor.id, new Set());
        });
        
        for (let i = 0; i < floors.length; i++) {
            for (let j = i + 1; j < floors.length; j++) {
                const f1 = floors[i];
                const f2 = floors[j];
                
                let connected = false;
                for (const p1 of f1.points) {
                    for (const p2 of f2.points) {
                        const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
                        if (dist <= tolerance) {
                            connected = true;
                            break;
                        }
                    }
                    if (connected) break;
                }
                
                if (connected) {
                    graph.get(f1.id).add(f2.id);
                    graph.get(f2.id).add(f1.id);
                }
            }
        }
        
        return graph;
    }
    
    // ========== Step 3: BFS 경로 탐색 ==========
    
    bfsPath(startFloor, endFloor, graph) {
        if (!startFloor || !endFloor) return null;
        if (startFloor.id === endFloor.id) return [startFloor];
        
        const visited = new Set();
        const queue = [[startFloor.id]];
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (current === endFloor.id) {
                return path.map(id => this.objects.find(o => o.id === id));
            }
            
            if (visited.has(current)) continue;
            visited.add(current);
            
            const neighbors = graph.get(current) || new Set();
            for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    queue.push([...path, neighborId]);
                }
            }
        }
        
        return null;
    }
    
    bfsReachable(startFloor, graph) {
        if (!startFloor) return new Set();
        
        const reachable = new Set();
        const queue = [startFloor.id];
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (reachable.has(current)) continue;
            reachable.add(current);
            
            const neighbors = graph.get(current) || new Set();
            for (const neighborId of neighbors) {
                if (!reachable.has(neighborId)) {
                    queue.push(neighborId);
                }
            }
        }
        
        return reachable;
    }
    
    // ========== Step 4: 끊긴 지점 찾기 ==========
    
    findGapBetweenSets(setA, setB) {
        const floors = this.getAllFloors();
        const floorsA = floors.filter(f => setA.has(f.id));
        const floorsB = floors.filter(f => setB.has(f.id));
        
        let bestGap = null;
        let minDist = Infinity;
        
        for (const fa of floorsA) {
            for (const fb of floorsB) {
                const gap = this.findClosestEdgePair(fa, fb);
                if (gap && gap.distance < minDist) {
                    minDist = gap.distance;
                    bestGap = gap;
                }
            }
        }
        
        return bestGap;
    }
    
    findClosestEdgePair(floor1, floor2) {
        let bestDist = Infinity;
        let best = null;
        
        const pts1 = floor1.points;
        const pts2 = floor2.points;
        
        for (let i = 0; i < pts1.length; i++) {
            const e1p1 = pts1[i];
            const e1p2 = pts1[(i + 1) % pts1.length];
            
            for (let j = 0; j < pts2.length; j++) {
                const e2p1 = pts2[j];
                const e2p2 = pts2[(j + 1) % pts2.length];
                
                const mid1 = { x: (e1p1.x + e1p2.x) / 2, y: (e1p1.y + e1p2.y) / 2 };
                const mid2 = { x: (e2p1.x + e2p2.x) / 2, y: (e2p1.y + e2p2.y) / 2 };
                const dist = Math.sqrt((mid1.x - mid2.x) ** 2 + (mid1.y - mid2.y) ** 2);
                
                if (dist < bestDist) {
                    bestDist = dist;
                    best = {
                        floor1, floor2,
                        edge1: { p1: e1p1, p2: e1p2, mid: mid1 },
                        edge2: { p1: e2p1, p2: e2p2, mid: mid2 },
                        distance: dist
                    };
                }
            }
        }
        
        return best;
    }
    
    // ========== Step 5: 후디니 스타일 정확한 Edge Extrusion ==========
    
    /**
     * Edge Extrusion 방식으로 통로 생성
     * - 기존 edge의 일부 구간을 선택 (slot)
     * - 해당 구간에서 직교 방향으로 extrude
     * - 목표 edge까지 도달하면 해당 edge와 정확히 vertex 공유
     */
    createCorridorWithBends(gap, width) {
        const corridors = [];
        const floor1 = gap.floor1;
        const floor2 = gap.floor2;
        
        // 1. 각 바닥에서 연결에 사용할 edge 구간(slot) 찾기
        const slot1 = this.findConnectionSlot(floor1, floor2, width);
        const slot2 = this.findConnectionSlot(floor2, floor1, width);
        
        if (!slot1 || !slot2) {
            console.log('연결 슬롯을 찾을 수 없음');
            return corridors;
        }
        
        console.log('Slot1:', slot1);
        console.log('Slot2:', slot2);
        
        // 2. 두 슬롯이 직선으로 연결 가능한지 확인
        const canDirectConnect = this.canDirectConnect(slot1, slot2);
        
        if (canDirectConnect) {
            // 직선 연결
            const corridor = this.extrudeStraight(slot1, slot2, width);
            if (corridor) corridors.push(corridor);
        } else {
            // L자 연결
            const lCorridors = this.extrudeLShape(slot1, slot2, width);
            corridors.push(...lCorridors);
        }
        
        return corridors;
    }
    
    /**
     * 바닥에서 목표 방향으로 연결할 edge 구간(slot) 찾기
     * slot = { start: {x,y}, end: {x,y}, direction: 'north'|'south'|'east'|'west' }
     */
    findConnectionSlot(floor, targetFloor, width) {
        const pts = floor.points;
        const targetCenter = this.getCenter(targetFloor.points);
        const myCenter = this.getCenter(pts);
        
        // 목표 방향
        const dx = targetCenter.x - myCenter.x;
        const dy = targetCenter.y - myCenter.y;
        
        // 가장 적합한 edge 찾기
        let bestEdge = null;
        let bestScore = -Infinity;
        let bestDirection = null;
        
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            
            // edge 중점과 법선
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            
            // edge 방향 및 법선 계산
            const edgeDx = p2.x - p1.x;
            const edgeDy = p2.y - p1.y;
            const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
            
            if (edgeLen < width) continue;  // 너무 짧은 edge 스킵
            
            // 법선 (바깥 방향)
            let nx = -edgeDy / edgeLen;
            let ny = edgeDx / edgeLen;
            
            // 법선이 중심에서 바깥쪽인지 확인
            const toMid = { x: midX - myCenter.x, y: midY - myCenter.y };
            if (nx * toMid.x + ny * toMid.y < 0) {
                nx = -nx;
                ny = -ny;
            }
            
            // 목표 방향과 법선의 일치도
            const dirLen = Math.sqrt(dx * dx + dy * dy);
            const score = (nx * dx + ny * dy) / dirLen;
            
            if (score > bestScore) {
                bestScore = score;
                bestEdge = { p1: {...p1}, p2: {...p2}, mid: {x: midX, y: midY} };
                
                // 방향 결정
                if (Math.abs(nx) > Math.abs(ny)) {
                    bestDirection = nx > 0 ? 'east' : 'west';
                } else {
                    bestDirection = ny > 0 ? 'south' : 'north';
                }
            }
        }
        
        if (!bestEdge) return null;
        
        // edge에서 width 만큼의 구간 선택 (중앙)
        const p1 = bestEdge.p1;
        const p2 = bestEdge.p2;
        const isVertical = bestDirection === 'east' || bestDirection === 'west';
        
        let slot;
        if (isVertical) {
            // 수직 edge (동/서 방향으로 연결)
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            const centerY = (minY + maxY) / 2;
            const halfW = Math.min(width / 2, (maxY - minY) / 2);
            
            slot = {
                start: { x: p1.x, y: centerY - halfW },
                end: { x: p1.x, y: centerY + halfW },
                direction: bestDirection,
                isVertical: true,
                x: p1.x
            };
        } else {
            // 수평 edge (남/북 방향으로 연결)
            const minX = Math.min(p1.x, p2.x);
            const maxX = Math.max(p1.x, p2.x);
            const centerX = (minX + maxX) / 2;
            const halfW = Math.min(width / 2, (maxX - minX) / 2);
            
            slot = {
                start: { x: centerX - halfW, y: p1.y },
                end: { x: centerX + halfW, y: p1.y },
                direction: bestDirection,
                isVertical: false,
                y: p1.y
            };
        }
        
        return slot;
    }
    
    // 중심점 계산
    getCenter(points) {
        const x = points.reduce((s, p) => s + p.x, 0) / points.length;
        const y = points.reduce((s, p) => s + p.y, 0) / points.length;
        return { x, y };
    }
    
    // 직선 연결 가능 여부
    canDirectConnect(slot1, slot2) {
        // 같은 축 방향이면 직선 연결 가능
        // slot1이 east/west이고 slot2도 east/west면 수평 직선
        // slot1이 north/south이고 slot2도 north/south면 수직 직선
        const isSlot1Horizontal = slot1.direction === 'east' || slot1.direction === 'west';
        const isSlot2Horizontal = slot2.direction === 'east' || slot2.direction === 'west';
        
        return isSlot1Horizontal === isSlot2Horizontal;
    }
    
    // 직선 extrude
    extrudeStraight(slot1, slot2, width) {
        const halfW = width / 2;
        let points;
        
        if (slot1.isVertical && slot2.isVertical) {
            // 둘 다 수직 slot → 수평 통로
            const x1 = slot1.x;
            const x2 = slot2.x;
            
            // Y 범위 겹침 계산
            const y1Min = Math.min(slot1.start.y, slot1.end.y);
            const y1Max = Math.max(slot1.start.y, slot1.end.y);
            const y2Min = Math.min(slot2.start.y, slot2.end.y);
            const y2Max = Math.max(slot2.start.y, slot2.end.y);
            
            const yStart = Math.max(y1Min, y2Min);
            const yEnd = Math.min(y1Max, y2Max);
            
            // 겹침이 있으면 그 범위 사용, 없으면 중간값
            let yA, yB;
            if (yEnd >= yStart) {
                yA = yStart;
                yB = yEnd;
            } else {
                const yMid = (y1Min + y1Max + y2Min + y2Max) / 4;
                yA = yMid - halfW;
                yB = yMid + halfW;
            }
            
            points = [
                { x: Math.min(x1, x2), y: yA, z: 0 },
                { x: Math.max(x1, x2), y: yA, z: 0 },
                { x: Math.max(x1, x2), y: yB, z: 0 },
                { x: Math.min(x1, x2), y: yB, z: 0 }
            ];
        } else {
            // 둘 다 수평 slot → 수직 통로
            const y1 = slot1.y;
            const y2 = slot2.y;
            
            const x1Min = Math.min(slot1.start.x, slot1.end.x);
            const x1Max = Math.max(slot1.start.x, slot1.end.x);
            const x2Min = Math.min(slot2.start.x, slot2.end.x);
            const x2Max = Math.max(slot2.start.x, slot2.end.x);
            
            const xStart = Math.max(x1Min, x2Min);
            const xEnd = Math.min(x1Max, x2Max);
            
            let xA, xB;
            if (xEnd >= xStart) {
                xA = xStart;
                xB = xEnd;
            } else {
                const xMid = (x1Min + x1Max + x2Min + x2Max) / 4;
                xA = xMid - halfW;
                xB = xMid + halfW;
            }
            
            points = [
                { x: xA, y: Math.min(y1, y2), z: 0 },
                { x: xB, y: Math.min(y1, y2), z: 0 },
                { x: xB, y: Math.max(y1, y2), z: 0 },
                { x: xA, y: Math.max(y1, y2), z: 0 }
            ];
        }
        
        return {
            id: this.nextId,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 55%, 50%, 0.6)',
            points: points,
            floorHeight: 0,
            closed: true,
            label: 'Corridor'
        };
    }
    
    // L자 extrude
    extrudeLShape(slot1, slot2, width) {
        const halfW = width / 2;
        const corridors = [];
        
        // slot1이 수직(동/서)이고 slot2가 수평(남/북)인 경우와 그 반대
        let vertSlot, horzSlot;
        if (slot1.isVertical) {
            vertSlot = slot1;
            horzSlot = slot2;
        } else {
            vertSlot = slot2;
            horzSlot = slot1;
        }
        
        // 꺾임점: 수직 slot의 X와 수평 slot의 Y가 만나는 점
        const bendX = vertSlot.x;
        const bendY = horzSlot.y;
        
        // 수직 slot의 Y 범위
        const vYmin = Math.min(vertSlot.start.y, vertSlot.end.y);
        const vYmax = Math.max(vertSlot.start.y, vertSlot.end.y);
        const vYcenter = (vYmin + vYmax) / 2;
        
        // 수평 slot의 X 범위
        const hXmin = Math.min(horzSlot.start.x, horzSlot.end.x);
        const hXmax = Math.max(horzSlot.start.x, horzSlot.end.x);
        const hXcenter = (hXmin + hXmax) / 2;
        
        // 첫 번째 구간: 수직 slot에서 꺾임점까지 (수평 통로)
        // vertex가 수직 slot의 edge에 정확히 맞닿도록
        const seg1Points = [
            { x: Math.min(bendX, vertSlot.x), y: vYmin, z: 0 },
            { x: Math.max(bendX, vertSlot.x), y: vYmin, z: 0 },
            { x: Math.max(bendX, vertSlot.x), y: vYmax, z: 0 },
            { x: Math.min(bendX, vertSlot.x), y: vYmax, z: 0 }
        ];
        
        // 방향에 따라 수평 확장
        if (vertSlot.direction === 'east') {
            // 동쪽으로 확장
            seg1Points[1].x = bendX + halfW;
            seg1Points[2].x = bendX + halfW;
        } else {
            // 서쪽으로 확장
            seg1Points[0].x = bendX - halfW;
            seg1Points[3].x = bendX - halfW;
        }
        
        corridors.push({
            id: this.nextId,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 55%, 50%, 0.6)',
            points: seg1Points,
            floorHeight: 0,
            closed: true,
            label: 'Corridor'
        });
        
        // 두 번째 구간: 꺾임점에서 수평 slot까지 (수직 통로)
        const seg2Points = [
            { x: bendX - halfW, y: Math.min(bendY, vYcenter), z: 0 },
            { x: bendX + halfW, y: Math.min(bendY, vYcenter), z: 0 },
            { x: bendX + halfW, y: Math.max(bendY, vYcenter), z: 0 },
            { x: bendX - halfW, y: Math.max(bendY, vYcenter), z: 0 }
        ];
        
        corridors.push({
            id: this.nextId,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 55%, 50%, 0.6)',
            points: seg2Points,
            floorHeight: 0,
            closed: true,
            label: 'Corridor'
        });
        
        // 세 번째 구간: 수평 방향으로 수평 slot까지
        const seg3Points = [
            { x: Math.min(bendX - halfW, hXmin), y: bendY - halfW, z: 0 },
            { x: Math.max(bendX + halfW, hXmax), y: bendY - halfW, z: 0 },
            { x: Math.max(bendX + halfW, hXmax), y: bendY + halfW, z: 0 },
            { x: Math.min(bendX - halfW, hXmin), y: bendY + halfW, z: 0 }
        ];
        
        corridors.push({
            id: this.nextId,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 55%, 50%, 0.6)',
            points: seg3Points,
            floorHeight: 0,
            closed: true,
            label: 'Corridor'
        });
        
        return corridors;
    }
    
    // 기존 함수 (하위 호환)
    createCorridorOnVertices(gap, width) {
        const corridors = this.createCorridorWithBends(gap, width);
        return corridors[0] || null;
    }
    
    // ========== 메인 함수: 통로 연결 ==========
    
    connect(width = 160) {
        const floors = this.getAllFloors();
        
        console.log('=== 프로시저럴 연결 시작 ===');
        console.log('바닥 수:', floors.length, '(polyfloor + floor-area)');
        
        // 1. 스폰/Objective 찾기
        const { defence, offence, objective } = this.findSpawnsAndObjective();
        
        console.log('Defence:', defence ? `(${defence.x}, ${defence.y})` : '없음');
        console.log('Offence:', offence ? `(${offence.x}, ${offence.y})` : '없음');
        console.log('Objective:', objective ? `(${objective.x}, ${objective.y})` : '없음');
        
        if (!objective) {
            return { success: false, message: 'Objective가 없습니다. 먼저 배치해주세요.', corridors: [] };
        }
        
        // Objective 중심점
        const objX = objective.x + (objective.width || 512) / 2;
        const objY = objective.y + (objective.height || 512) / 2;
        
        // 2. 각 지점이 포함된 바닥 찾기
        const defFloor = defence ? 
            (this.findFloorContainingPoint(defence.x + 160, defence.y + 160) || 
             this.findFloorNearPoint(defence.x + 160, defence.y + 160)) : null;
        const offFloor = offence ? 
            (this.findFloorContainingPoint(offence.x + 160, offence.y + 160) || 
             this.findFloorNearPoint(offence.x + 160, offence.y + 160)) : null;
        const objFloor = this.findFloorContainingPoint(objX, objY) || 
                         this.findFloorNearPoint(objX, objY);
        
        console.log('Defence 바닥:', defFloor ? defFloor.label || defFloor.id : '없음');
        console.log('Offence 바닥:', offFloor ? offFloor.label || offFloor.id : '없음');
        console.log('Objective 바닥:', objFloor ? objFloor.label || objFloor.id : '없음');
        
        // 3. 연결 그래프 생성
        const graph = this.buildConnectionGraph();
        console.log('연결 그래프 노드 수:', graph.size);
        
        // 4. 경로 체크 및 끊긴 지점에 통로 생성
        const corridors = [];
        const messages = [];
        
        // Defence → Objective 경로
        if (defFloor && objFloor) {
            let path = this.bfsPath(defFloor, objFloor, graph);
            console.log('Defence→Objective 경로:', path ? path.map(f => f.label || f.id).join(' → ') : '없음');
            
            if (!path) {
                const reachableFromDef = this.bfsReachable(defFloor, graph);
                const reachableFromObj = this.bfsReachable(objFloor, graph);
                
                console.log('Defence에서 도달 가능:', reachableFromDef.size, '개');
                console.log('Objective에서 도달 가능:', reachableFromObj.size, '개');
                
                const gap = this.findGapBetweenSets(reachableFromDef, reachableFromObj);
                console.log('Gap:', gap ? `${Math.round(gap.distance / 32)}m` : '없음');
                
                if (gap && gap.distance < 100 * 32) {  // 100m까지 허용
                    const newCorridors = this.createCorridorWithBends(gap, width);
                    if (newCorridors.length > 0) {
                        corridors.push(...newCorridors);
                        messages.push(`Defence→Objective 연결 (${Math.round(gap.distance / 32)}m, ${newCorridors.length}개 세그먼트)`);
                    }
                } else {
                    messages.push(`Defence→Objective 너무 멀음 (${gap ? Math.round(gap.distance / 32) : '?'}m)`);
                }
            } else {
                messages.push('Defence→Objective 이미 연결됨');
            }
        } else {
            if (!defFloor) messages.push('Defence 바닥 없음');
            if (!objFloor) messages.push('Objective 바닥 없음');
        }
        
        // Offence → Objective 경로
        if (offFloor && objFloor) {
            const tempGraph = this.buildConnectionGraph();
            let path = this.bfsPath(offFloor, objFloor, tempGraph);
            
            if (!path) {
                const reachableFromOff = this.bfsReachable(offFloor, tempGraph);
                const reachableFromObj = this.bfsReachable(objFloor, tempGraph);
                
                const gap = this.findGapBetweenSets(reachableFromOff, reachableFromObj);
                
                if (gap && gap.distance < 100 * 32) {
                    const newCorridors = this.createCorridorWithBends(gap, width);
                    if (newCorridors.length > 0) {
                        corridors.push(...newCorridors);
                        messages.push(`Offence→Objective 연결 (${Math.round(gap.distance / 32)}m, ${newCorridors.length}개 세그먼트)`);
                    }
                }
            } else {
                messages.push('Offence→Objective 이미 연결됨');
            }
        }
        
        return {
            success: corridors.length > 0,
            message: messages.join(', '),
            corridors
        };
    }
}

// 전역 접근용
window.ProceduralGenerator = ProceduralGenerator;
