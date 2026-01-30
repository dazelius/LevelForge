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
    
    // ========== Step 1: 스폰/Objective 위치 파악 ==========
    
    findSpawnsAndObjective() {
        const defence = this.objects.find(o => o.type === 'spawn-def');
        const offence = this.objects.find(o => o.type === 'spawn-off');
        const objective = this.objects.find(o => o.type === 'objective');
        return { defence, offence, objective };
    }
    
    findFloorContainingPoint(x, y) {
        const floors = this.objects.filter(o => o.type === 'polyfloor' && o.points?.length >= 3);
        return floors.find(floor => this.app.isPointInPolygon(x, y, floor.points));
    }
    
    findFloorNearPoint(x, y, maxDist = 500) {
        const floors = this.objects.filter(o => o.type === 'polyfloor' && o.points?.length >= 3);
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
        const floors = this.objects.filter(o => o.type === 'polyfloor' && o.points?.length >= 3);
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
        const floors = this.objects.filter(o => o.type === 'polyfloor' && o.points?.length >= 3);
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
    
    // ========== Step 5: 통로 생성 ==========
    
    createCorridorOnVertices(gap, width) {
        const { edge1, edge2 } = gap;
        const halfW = width / 2;
        
        const isE1Vertical = Math.abs(edge1.p2.x - edge1.p1.x) < Math.abs(edge1.p2.y - edge1.p1.y);
        const isE2Vertical = Math.abs(edge2.p2.x - edge2.p1.x) < Math.abs(edge2.p2.y - edge2.p1.y);
        
        let p1, p2, p3, p4;
        
        if (isE1Vertical && isE2Vertical) {
            // 둘 다 수직 edge → 수평 통로
            const y1Range = [Math.min(edge1.p1.y, edge1.p2.y), Math.max(edge1.p1.y, edge1.p2.y)];
            const y2Range = [Math.min(edge2.p1.y, edge2.p2.y), Math.max(edge2.p1.y, edge2.p2.y)];
            
            const yStart = Math.max(y1Range[0], y2Range[0]);
            const yEnd = Math.min(y1Range[1], y2Range[1]);
            const yMid = (yStart + yEnd) / 2;
            const x1 = edge1.p1.x;
            const x2 = edge2.p1.x;
            
            p1 = { x: x1, y: yMid - halfW, z: 0 };
            p2 = { x: x2, y: yMid - halfW, z: 0 };
            p3 = { x: x2, y: yMid + halfW, z: 0 };
            p4 = { x: x1, y: yMid + halfW, z: 0 };
            
        } else if (!isE1Vertical && !isE2Vertical) {
            // 둘 다 수평 edge → 수직 통로
            const x1Range = [Math.min(edge1.p1.x, edge1.p2.x), Math.max(edge1.p1.x, edge1.p2.x)];
            const x2Range = [Math.min(edge2.p1.x, edge2.p2.x), Math.max(edge2.p1.x, edge2.p2.x)];
            
            const xStart = Math.max(x1Range[0], x2Range[0]);
            const xEnd = Math.min(x1Range[1], x2Range[1]);
            const xMid = (xStart + xEnd) / 2;
            const y1 = edge1.p1.y;
            const y2 = edge2.p1.y;
            
            p1 = { x: xMid - halfW, y: y1, z: 0 };
            p2 = { x: xMid + halfW, y: y1, z: 0 };
            p3 = { x: xMid + halfW, y: y2, z: 0 };
            p4 = { x: xMid - halfW, y: y2, z: 0 };
            
        } else {
            // 다른 방향 → 대각선 통로
            const x1 = edge1.mid.x;
            const y1 = edge1.mid.y;
            const x2 = edge2.mid.x;
            const y2 = edge2.mid.y;
            
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len * halfW;
            const ny = dx / len * halfW;
            
            p1 = { x: x1 + nx, y: y1 + ny, z: 0 };
            p2 = { x: x2 + nx, y: y2 + ny, z: 0 };
            p3 = { x: x2 - nx, y: y2 - ny, z: 0 };
            p4 = { x: x1 - nx, y: y1 - ny, z: 0 };
        }
        
        return {
            id: this.nextId,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 55%, 50%, 0.6)',
            points: [p1, p2, p3, p4],
            floorHeight: 0,
            closed: true,
            label: 'Corridor'
        };
    }
    
    // ========== 메인 함수: 통로 연결 ==========
    
    connect(width = 160) {
        const floors = this.objects.filter(o => o.type === 'polyfloor' && o.points?.length >= 3);
        
        console.log('=== 프로시저럴 연결 시작 ===');
        console.log('바닥 수:', floors.length);
        
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
                
                if (gap && gap.distance < 50 * 32) {
                    const corridor = this.createCorridorOnVertices(gap, width);
                    if (corridor) {
                        corridors.push(corridor);
                        messages.push(`Defence→Objective 연결 (${Math.round(gap.distance / 32)}m)`);
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
                
                if (gap && gap.distance < 50 * 32) {
                    const corridor = this.createCorridorOnVertices(gap, width);
                    if (corridor) {
                        corridors.push(corridor);
                        messages.push(`Offence→Objective 연결 (${Math.round(gap.distance / 32)}m)`);
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
