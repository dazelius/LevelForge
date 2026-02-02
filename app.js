/**
 * LEVELFORGE - Professional FPS Level Designer
 * A streamlined tool for sketching FPS game levels
 */

class LevelForge {
    constructor() {
        this.initState();
        this.initCanvas();
        this.bindEvents();
        this.render();
    }
    
    // 단일 선택 전용 메소드
    select(id) {
        this._singleSelectedId = id;
    }
    
    clearSelection() {
        this._singleSelectedId = null;
    }
    
    isSelected(id) {
        return this._singleSelectedId === id;
    }
    
    hasSelection() {
        return this._singleSelectedId !== null;
    }

    initCanvas() {
        this.container = document.getElementById('canvasContainer');
        this.gridCanvas = document.getElementById('gridCanvas');
        this.mainCanvas = document.getElementById('mainCanvas');
        this.uiCanvas = document.getElementById('uiCanvas');
        
        this.gridCtx = this.gridCanvas.getContext('2d');
        this.ctx = this.mainCanvas.getContext('2d');
        this.uiCtx = this.uiCanvas.getContext('2d');
        
        this.resize();
    }

    initState() {
        // Level info
        this.levelName = 'Untitled';
        
        // FBX output path (loaded from localStorage)
        this.fbxOutputPath = localStorage.getItem('levelforge_fbxOutputPath') || 'C:\\Aegis\\Client\\Project_Aegis\\Assets\\DevAssets(not packed)\\_DevArt\\Environment\\Temp_M1\\M1_Maps\\LevelData';
        
        // Recent files (최대 10개)
        this.recentFiles = JSON.parse(localStorage.getItem('levelforge_recentFiles') || '[]');
        
        // Core data
        this.objects = [];
        this._singleSelectedId = null;  // 단일 선택 ID 저장
        
        // View state
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.gridSize = 32;  // 32px = 1m
        this.pixelsPerMeter = 32;
        this.showGrid = true;
        this.snapToGrid = true;
        this.diagSnap = false;  // 45도 대각선 스냅
        this.currentFloor = 0;
        
        // Tool state
        this.currentTool = 'select';
        this.currentZoneType = 'combat';
        
        // 오브젝트 타입별 고정 색상 (다크 모드에 최적화)
        this.typeColors = {
            'floor-area': '#4a90a4',  // 바닥 - 청록
            'wall': '#e0e0e0',        // 벽 - 밝은 회색
            'wall-diag': '#e0e0e0',   // 대각선 벽 - 밝은 회색
            'polywall': '#e0e0e0',    // 폴리 벽 - 밝은 회색
            'cover-full': '#f5b041',  // 풀커버 - 주황
            'cover-half': '#f7dc6f',  // 하프커버 - 노랑
            'ramp': '#a0522d',        // 경사로 - 시에나
            'door': '#cd853f',        // 문 - 페루
        };
        
        // Layer visibility
        this.layers = {
            floors: true,
            walls: true,
            markers: true,
            analysis: true,
            zones: true
        };
        
        // Height settings
        this.currentHeight = 0;  // 현재 바닥 높이 (미터)
        
        // Interaction state
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
        this.isDrawing = false;
        this.isPanning = false;
        this.isDragging = false;
        this.drawStart = null;
        this.dragStart = null;
        this.pathPoints = [];
        this.pathPointsRedo = [];  // 점 단위 redo용
        
        // Corridor tool state
        this.corridorStart = null;  // { floor, edge, point }
        this.corridorWaypoints = [];  // 경유점 배열 [{ x, y }]
        this.corridorHoverEdge = null;  // 현재 호버 중인 edge
        this.corridorWidth = 5 * 32;  // 기본 5m
        
        // History
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
        
        // ID counter
        this.nextId = 1;
        
        // Reference image
        this.refImage = null;
        this.refImageOpacity = 0.5;
        this.refImageScale = 1;
        this.refImageOffset = { x: 0, y: 0 };
        this.refDragMode = false;
        this.refDragging = false;
        this.refDragStart = null;
        
        // Sketch
        this.sketchStrokes = [];  // 브러시 획 저장
        this.currentStroke = null;
        this.sketchBrushSize = 8;
        this.isSketchDrawing = false;
        
        // Spline
        this.splineWidth = 160;  // 5m 기본 너비
        
        // Vertex editing (점 편집)
        this.selectedVertex = null;  // { objId, pointIndex } - 드래그용
        this.selectedVertices = [];  // [{ objId, pointIndex }, ...] - 여러 점 선택
        this.isVertexDragging = false;
        
        // Simulation (시뮬레이션)
        this.simRunning = false;
        this.simAgents = [];
        this.simLastTime = 0;
        this.simSpeed = 4.5;  // m/s
        this.simViewRange = 15;  // 시야 거리 (미터)
        this.simViewAngle = 90;  // 시야각 (도)
        this.simRespawnTime = 3000;  // 리스폰 시간 (ms)
        this.simScore = { defence: 0, offence: 0 };
        
        // Route Preview (경로 미리보기)
        this.previewPaths = [];  // 미리보기 경로들
        this.showPreview = false;
        
        // Pin Mode (핀 꽂기 - 교전 테스트)
        this.pinMode = false;
        this.pinLocation = null;  // { x, y }
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        [this.gridCanvas, this.mainCanvas, this.uiCanvas].forEach(canvas => {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            canvas.getContext('2d').scale(dpr, dpr);
        });
        
        this.width = rect.width;
        this.height = rect.height;
        
        // Center camera on first load
        if (this.camera && this.camera.x === 0 && this.camera.y === 0) {
            this.camera.x = this.width / 2;
            this.camera.y = this.height / 2;
        }
        
        if (this.camera) {
            this.renderGrid();
            this.render();
        }
    }

    // ========== EVENT BINDING ==========
    bindEvents() {
        // Window
        window.addEventListener('resize', () => this.resize());
        
        // Canvas mouse events
        this.mainCanvas.addEventListener('mousedown', e => this.onMouseDown(e));
        this.mainCanvas.addEventListener('mousemove', e => this.onMouseMove(e));
        this.mainCanvas.addEventListener('mouseup', e => this.onMouseUp(e));
        this.mainCanvas.addEventListener('mouseleave', e => this.onMouseUp(e));
        this.mainCanvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });
        this.mainCanvas.addEventListener('contextmenu', e => e.preventDefault());
        this.mainCanvas.addEventListener('dblclick', e => this.onDoubleClick(e));
        
        // Keyboard
        document.addEventListener('keydown', e => this.onKeyDown(e));
        document.addEventListener('keyup', e => this.onKeyUp(e));
        
        // Tool buttons
        document.querySelectorAll('.tool-btn, .tool-btn-wide').forEach(btn => {
            btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
        });
        
        // Zone types
        document.querySelectorAll('.zone-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.zone-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentZoneType = btn.dataset.zone;
            });
        });
        
        // Layer toggles
        document.querySelectorAll('.layer-toggle input').forEach(input => {
            input.addEventListener('change', () => {
                this.layers[input.dataset.layer] = input.checked;
                this.render();
            });
        });
        
        // Menu buttons
        document.getElementById('newBtn').addEventListener('click', () => this.newProject());
        document.getElementById('openBtn').addEventListener('click', () => this.openFile());
        document.getElementById('recentBtn')?.addEventListener('click', e => {
            e.stopPropagation();
            this.toggleRecentDropdown();
        });
        document.addEventListener('click', e => {
            const dropdown = document.getElementById('recentDropdown');
            if (dropdown && !dropdown.contains(e.target) && e.target.id !== 'recentBtn') {
                dropdown.style.display = 'none';
            }
        });
        document.getElementById('fileInput').addEventListener('change', e => this.loadFile(e));
        document.getElementById('levelNameDisplay')?.addEventListener('click', () => this.showRenameDialog());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveFile());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportImage());
        document.getElementById('exportBlenderBtn').addEventListener('click', () => this.showBlenderExportDialog());
        
        // Image trace buttons
        document.getElementById('loadRefImageBtn')?.addEventListener('click', () => document.getElementById('refImageInput').click());
        document.getElementById('refImageInput')?.addEventListener('change', e => this.loadReferenceImage(e));
        document.getElementById('convertSketchBtn')?.addEventListener('click', () => this.convertSketchToWalls());
        document.getElementById('clearSketchBtn')?.addEventListener('click', () => this.clearSketch());
        
        // Spline width slider
        const splineWidthSlider = document.getElementById('splineWidth');
        if (splineWidthSlider) {
            splineWidthSlider.addEventListener('input', e => {
                this.splineWidth = parseInt(e.target.value);
                this.updateSplineWidthLabel();
                this.render();
            });
        }
        
        // 스플라인 너비 +/- 버튼
        document.getElementById('splineWidthMinus')?.addEventListener('click', () => {
            this.splineWidth = Math.max(32, this.splineWidth - 32);  // 최소 1m
            document.getElementById('splineWidth').value = this.splineWidth;
            this.updateSplineWidthLabel();
            this.render();
        });
        
        document.getElementById('splineWidthPlus')?.addEventListener('click', () => {
            this.splineWidth = Math.min(320, this.splineWidth + 32);  // 최대 10m
            document.getElementById('splineWidth').value = this.splineWidth;
            this.updateSplineWidthLabel();
            this.render();
        });
        
        // Clipboard paste (Ctrl+V) for reference image
        document.addEventListener('paste', e => this.handlePaste(e));
        
        // Simulation buttons
        document.getElementById('simPreviewBtn')?.addEventListener('click', () => this.previewRoutes());
        document.getElementById('simStartBtn')?.addEventListener('click', () => this.startSimulation());
        document.getElementById('simStopBtn')?.addEventListener('click', () => this.stopSimulation());
        document.getElementById('simPinBtn')?.addEventListener('click', () => this.togglePinMode());
        
        // AI Assistant
        document.getElementById('aiChatBtn')?.addEventListener('click', () => this.toggleAIPanel());
        document.getElementById('aiCloseBtn')?.addEventListener('click', () => this.toggleAIPanel(false));
        document.getElementById('aiSendBtn')?.addEventListener('click', () => this.sendAIMessage());
        document.getElementById('aiInput')?.addEventListener('keypress', e => {
            if (e.key === 'Enter') this.sendAIMessage();
        });
        document.querySelectorAll('.ai-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('aiInput').value = btn.dataset.prompt;
                this.sendAIMessage();
            });
        });
        
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.25));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('zoomFit').addEventListener('click', () => this.zoomFit());
        
        // Grid options
        document.getElementById('gridToggle').addEventListener('change', e => {
            this.showGrid = e.target.checked;
            this.renderGrid();
        });
        
        document.getElementById('snapToggle').addEventListener('change', e => {
            this.snapToGrid = e.target.checked;
        });
        
        document.getElementById('diagSnapToggle').addEventListener('change', e => {
            this.diagSnap = e.target.checked;
        });

        document.getElementById('gridSizeSelect').addEventListener('change', e => {
            this.gridSize = parseInt(e.target.value);
            this.pixelsPerMeter = 32;  // 기본 1m = 32px 기준
            this.renderGrid();
        });
        
        // Height control
        document.getElementById('floorHeight').addEventListener('change', e => {
            this.currentHeight = parseFloat(e.target.value) || 0;
            this.updateHeightButtons();
            this.applyHeightToSelected();
        });
        
        document.querySelectorAll('.height-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentHeight = parseFloat(btn.dataset.height);
                document.getElementById('floorHeight').value = this.currentHeight;
                this.updateHeightButtons();
                this.applyHeightToSelected();
            });
        });
        
        // AI direction buttons
        document.querySelectorAll('.ai-dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.ai-dir-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.aiFlowDirection = btn.dataset.dir;
            });
        });
        this.aiFlowDirection = 'auto';
    }

    // ========== COORDINATE TRANSFORMS ==========
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.camera.x) / this.camera.zoom,
            y: (sy - this.camera.y) / this.camera.zoom
        };
    }

    worldToScreen(wx, wy) {
        return {
            x: wx * this.camera.zoom + this.camera.x,
            y: wy * this.camera.zoom + this.camera.y
        };
    }

    snap(x, y, fromPoint = null, shiftKey = false) {
        if (!this.snapToGrid && !shiftKey) return { x, y };
        
        // Shift 키 직선 스냅 (수평/수직/45도) - fromPoint가 있을 때만
        if (shiftKey && fromPoint) {
            const dx = x - fromPoint.x;
            const dy = y - fromPoint.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            
            // 가장 가까운 45도 각도로 스냅 (0, 45, 90, 135, 180, -135, -90, -45)
            const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            let snappedX = fromPoint.x + Math.cos(snapAngle) * dist;
            let snappedY = fromPoint.y + Math.sin(snapAngle) * dist;
            
            // 그리드에도 스냅
            if (this.snapToGrid) {
                snappedX = Math.round(snappedX / this.gridSize) * this.gridSize;
                snappedY = Math.round(snappedY / this.gridSize) * this.gridSize;
            }
            
            return { x: snappedX, y: snappedY, snapType: 'shift' };
        }
        
        if (!this.snapToGrid) return { x, y };
        
        // 1. 먼저 다른 오브젝트의 점(vertex)에 스냅 시도
        const vertexSnap = this.snapToVertex(x, y);
        if (vertexSnap) {
            return { ...vertexSnap, snapType: 'vertex' };
        }
        
        // 2. 엣지(변)에 스냅 시도
        const edgeSnap = this.snapToEdge(x, y);
        if (edgeSnap) {
            return { ...edgeSnap, snapType: 'edge' };
        }
        
        let snappedX = Math.round(x / this.gridSize) * this.gridSize;
        let snappedY = Math.round(y / this.gridSize) * this.gridSize;
        
        // 45도 대각선 스냅 (시작점이 있을 때만)
        if (this.diagSnap && fromPoint) {
            const dx = x - fromPoint.x;
            const dy = y - fromPoint.y;
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            const angle = Math.atan2(dy, dx);
            
            // 가장 가까운 45도 각도로 스냅
            const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            snappedX = fromPoint.x + Math.cos(snapAngle) * dist;
            snappedY = fromPoint.y + Math.sin(snapAngle) * dist;
            
            // 그리드에도 스냅
            snappedX = Math.round(snappedX / this.gridSize) * this.gridSize;
            snappedY = Math.round(snappedY / this.gridSize) * this.gridSize;
        }
        
        return { x: snappedX, y: snappedY };
    }
    
    // 엣지(변)에 스냅
    snapToEdge(x, y) {
        const threshold = 15;  // 스냅 거리 (픽셀)
        let closest = null;
        let minDist = threshold;
        
        for (const obj of this.objects) {
            if (obj.floor !== this.currentFloor) continue;
            if (!obj.points || obj.points.length < 2) continue;
            
            const points = obj.points;
            const len = points.length;
            
            // 각 엣지 검사
            for (let i = 0; i < len; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % len];
                
                // 점에서 선분까지 가장 가까운 점 계산
                const nearestPoint = this.nearestPointOnSegment(x, y, p1.x, p1.y, p2.x, p2.y);
                const dist = Math.hypot(x - nearestPoint.x, y - nearestPoint.y);
                
                if (dist < minDist) {
                    minDist = dist;
                    closest = nearestPoint;
                }
            }
        }
        
        return closest;
    }
    
    // 점에서 선분까지 가장 가까운 점 계산
    nearestPointOnSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        
        if (lenSq === 0) {
            // 선분 길이가 0이면 시작점 반환
            return { x: x1, y: y1 };
        }
        
        // 선분 위의 위치 t (0~1 범위로 클램프)
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        
        return {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
    }
    
    // 다른 오브젝트의 점(vertex)에 스냅
    snapToVertex(x, y) {
        return this.snapToVertexExcept(x, y, null, null);
    }
    
    // 특정 점을 제외하고 다른 점에 스냅
    snapToVertexExcept(x, y, excludeObjId, excludePointIndex) {
        const threshold = 20;  // 스냅 거리 (픽셀)
        let closest = null;
        let minDist = threshold;
        
        // 현재 층의 모든 오브젝트 점 검사
        for (const obj of this.objects) {
            if (obj.floor !== this.currentFloor) continue;
            if (!obj.points || obj.points.length === 0) continue;
            
            for (let i = 0; i < obj.points.length; i++) {
                // 제외할 점 스킵
                if (obj.id === excludeObjId && i === excludePointIndex) continue;
                
                const p = obj.points[i];
                const dist = Math.hypot(x - p.x, y - p.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = { x: p.x, y: p.y };
                }
            }
        }
        
        return closest;
    }
    
    // 미터 단위로 변환
    toMeters(pixels) {
        return pixels / this.pixelsPerMeter;
    }
    
    fromMeters(meters) {
        return meters * this.pixelsPerMeter;
    }

    // ========== MOUSE HANDLERS ==========
    onMouseDown(e) {
        const rect = this.mainCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = this.screenToWorld(sx, sy);
        
        // Shift 직선 스냅을 위한 fromPoint 계산
        const fromPoint = this.pathPoints.length > 0 ? this.pathPoints[this.pathPoints.length - 1] : null;
        const snapped = this.snap(world.x, world.y, fromPoint, e.shiftKey);
        
        this.mouse = { x: sx, y: sy, worldX: world.x, worldY: world.y };

        // 경로 연결 모드
        if (this.pathConnectMode && e.button === 0) {
            this.handlePathConnectClick(world.x, world.y);
            return;
        }

        // 핀 모드 - 시뮬레이션 중 클릭하면 핀 꽂기
        if (this.pinMode && this.simRunning && e.button === 0) {
            this.placePin(world.x, world.y);
            return;
        }
        
        // AI 영역 지정 모드
        if (this.aiAreaMode && e.button === 0) {
            this.aiAreaDragStart = { x: world.x, y: world.y };
            return;
        }
        
        // AI 미리보기 클릭 (선택/해제)
        if (this.aiPendingObjects && e.button === 0) {
            if (this.handleAIPreviewClick(world.x, world.y)) {
                return;
            }
        }

        // Reference image drag mode
        if (this.refDragMode && this.refImage && e.button === 0) {
            this.refDragging = true;
            this.refDragStart = { 
                x: sx, 
                y: sy, 
                offsetX: this.refImageOffset.x, 
                offsetY: this.refImageOffset.y 
            };
            this.mainCanvas.style.cursor = 'grabbing';
            return;
        }

        // Right click or middle click = pan
        if (e.button === 2 || e.button === 1 || this.currentTool === 'pan') {
            this.isPanning = true;
            this.panStart = { x: sx - this.camera.x, y: sy - this.camera.y };
            this.mainCanvas.style.cursor = 'grabbing';
            return;
        }

        if (this.currentTool === 'select') {
            // 먼저 점(vertex) 선택 체크
            const vertexHit = this.hitTestVertex(world.x, world.y);
            if (vertexHit) {
                // 항상 단일 점 선택
                this.selectedVertices = [{ objId: vertexHit.objId, pointIndex: vertexHit.pointIndex }];
                this.selectedVertex = vertexHit;
                this.isVertexDragging = true;
                this.dragStart = { x: snapped.x, y: snapped.y };
                this.select(vertexHit.objId);
                this.updateProps();
                this.updateObjectsList();
                this.render();
                return;
            }
            
            // 점이 아니면 오브젝트 선택 (항상 단일 선택)
            this.selectedVertex = null;
            this.selectedVertices = [];
            const hit = this.hitTest(world.x, world.y);
            if (hit) {
                // 항상 클릭한 오브젝트만 선택
                this.select(hit.id);
                this.isDragging = true;
                this.dragStart = { x: snapped.x, y: snapped.y };
            } else {
                this.clearSelection();
            }
            this.updateProps();
            this.updateObjectsList();
        } else if (['sightline', 'path', 'polywall', 'polygon', 'spline'].includes(this.currentTool)) {
            // Shift 키: 직선 스냅 우선
            // 아니면 다른 오브젝트 점에 우선 스냅, 없으면 그리드 스냅
            let pointToAdd;
            if (e.shiftKey && fromPoint) {
                // Shift 누르면 직선 스냅 우선
                pointToAdd = snapped;
            } else {
                const vertexSnap = this.snapToVertex(world.x, world.y);
                pointToAdd = vertexSnap || snapped;
            }
            this.pathPoints.push(pointToAdd);
            this.pathPointsRedo = [];  // 새 점 추가 시 redo 초기화
        } else if (this.currentTool === 'wall-diag') {
            this.isDrawing = true;
            this.drawStart = snapped;
        } else if (['spawn-def', 'spawn-off', 'objective', 'item'].includes(this.currentTool)) {
            this.createMarker(snapped.x, snapped.y);
        } else if (this.currentTool === 'corridor') {
            // 통로 연결 도구: edge 클릭
            this.handleCorridorClick(world.x, world.y);
        } else if (this.currentTool === 'measure') {
            this.isDrawing = true;
            this.drawStart = snapped;
        } else if (this.currentTool === 'sketch') {
            // 스케치 시작
            this.isSketchDrawing = true;
            this.currentStroke = {
                points: [{ x: world.x, y: world.y }],
                size: this.sketchBrushSize,
                color: '#e84393'
            };
        } else if (this.currentTool === 'eraser') {
            // 지우개
            this.isSketchDrawing = true;
            this.eraseAtPoint(world.x, world.y);
        } else {
            this.isDrawing = true;
            this.drawStart = snapped;
        }

        this.render();
    }

    onMouseMove(e) {
        const rect = this.mainCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = this.screenToWorld(sx, sy);
        
        // 대각선 스냅: 시작점이나 마지막 포인트 기준
        // Shift 키로 직선 스냅 (수평/수직/45도)
        const fromPoint = this.drawStart || (this.pathPoints.length > 0 ? this.pathPoints[this.pathPoints.length - 1] : null);
        const snapped = this.snap(world.x, world.y, fromPoint, e.shiftKey);
        
        // snapped 좌표도 저장 (가이드라인용)
        this.mouse = { x: sx, y: sy, worldX: world.x, worldY: world.y, snappedX: snapped.x, snappedY: snapped.y };
        
        // Corridor 도구: edge hover 감지
        if (this.currentTool === 'corridor') {
            this.corridorHoverEdge = this.findNearestEdge(world.x, world.y, 20);
            this.render();
        }
        
        // Update coords display (미터 단위) - snapped 좌표 표시
        const mx = this.toMeters(snapped.x).toFixed(1);
        const my = this.toMeters(snapped.y).toFixed(1);
        document.getElementById('coordsDisplay').textContent = `${mx}m, ${my}m`;

        // Reference image dragging
        if (this.refDragging && this.refDragStart) {
            const dx = (sx - this.refDragStart.x) / this.camera.zoom;
            const dy = (sy - this.refDragStart.y) / this.camera.zoom;
            this.refImageOffset = {
                x: this.refDragStart.offsetX + dx,
                y: this.refDragStart.offsetY + dy
            };
            this.render();
            return;
        }
        
        // AI 영역 드래그
        if (this.aiAreaMode && this.aiAreaDragStart) {
            this.handleAIAreaDrag(this.aiAreaDragStart.x, this.aiAreaDragStart.y, world.x, world.y);
            return;
        }

        if (this.isPanning) {
            this.camera.x = sx - this.panStart.x;
            this.camera.y = sy - this.panStart.y;
            this.renderGrid();
            this.render();
            return;
        }

        // 점(vertex) 드래그 - 직접 스냅 위치로 이동
        if (this.isVertexDragging && this.selectedVertex && this.dragStart) {
            const obj = this.objects.find(o => o.id === this.selectedVertex.objId);
            if (obj && obj.points && obj.points[this.selectedVertex.pointIndex]) {
                const currentPoint = obj.points[this.selectedVertex.pointIndex];
                
                // 다른 점에 스냅 (현재 드래그 중인 점 제외)
                const vertexSnap = this.snapToVertexExcept(world.x, world.y, this.selectedVertex.objId, this.selectedVertex.pointIndex);
                const targetPos = vertexSnap || snapped;
                
                if (currentPoint.x !== targetPos.x || currentPoint.y !== targetPos.y) {
                    // 점 위치 직접 설정
                    currentPoint.x = targetPos.x;
                    currentPoint.y = targetPos.y;
                    
                    // 바운딩 박스 재계산
                    this.updatePolyBounds(obj);
                    this.render();
                }
            }
            return;
        }

        if (this.isDragging && (this.hasSelection() ? 1 : 0) > 0 && this.dragStart) {
            const prevSnap = this.snap(this.dragStart.x, this.dragStart.y);
            const dx = snapped.x - prevSnap.x;
            const dy = snapped.y - prevSnap.y;
            
            if (dx !== 0 || dy !== 0) {
                this.getSelected().forEach(obj => {
                    obj.x += dx;
                    obj.y += dy;
                    if (obj.x2 !== undefined) { obj.x2 += dx; obj.y2 += dy; }
                    if (obj.points) {
                        obj.points = obj.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    }
                });
                this.dragStart = snapped;
                this.render();
            }
            return;
        }

        // Sketch drawing
        if (this.isSketchDrawing && this.currentTool === 'sketch' && this.currentStroke) {
            this.currentStroke.points.push({ x: world.x, y: world.y });
            this.render();
            return;
        }

        // Eraser
        if (this.isSketchDrawing && this.currentTool === 'eraser') {
            this.eraseAtPoint(world.x, world.y);
            this.render();
            return;
        }

        // Preview
        this.renderUI(snapped);
        
        // Cursor
        if (this.currentTool === 'select') {
            // 점(vertex) 근처면 다른 커서
            const vertexHit = this.hitTestVertex(world.x, world.y);
            if (vertexHit) {
                this.mainCanvas.style.cursor = 'crosshair';
            } else {
                const hit = this.hitTest(world.x, world.y);
                this.mainCanvas.style.cursor = hit ? 'move' : 'default';
            }
        } else if (this.currentTool === 'pan') {
            this.mainCanvas.style.cursor = 'grab';
        } else {
            this.mainCanvas.style.cursor = 'crosshair';
        }
    }

    onMouseUp(e) {
        if (!e.clientX && !e.clientY) {
            // mouseleave with no coordinates
            this.isDrawing = false;
            this.isDragging = false;
            this.isPanning = false;
            this.refDragging = false;
            this.drawStart = null;
            this.clearUI();
            return;
        }
        
        const rect = this.mainCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = this.screenToWorld(sx, sy);
        const snapped = this.snap(world.x, world.y);

        // Reference image drag end
        if (this.refDragging) {
            this.refDragging = false;
            this.mainCanvas.style.cursor = this.refDragMode ? 'grab' : 'default';
            return;
        }

        // Sketch stroke complete
        if (this.isSketchDrawing) {
            this.isSketchDrawing = false;
            if (this.currentStroke && this.currentStroke.points.length > 1) {
                this.sketchStrokes.push(this.currentStroke);
            }
            this.currentStroke = null;
            this.render();
            return;
        }
        
        // AI 영역 지정 완료
        if (this.aiAreaMode && this.aiAreaDragStart) {
            this.aiAreaDragStart = null;
            this.finishAIAreaSelection();
            return;
        }

        if (this.isPanning) {
            this.isPanning = false;
            this.mainCanvas.style.cursor = this.currentTool === 'pan' ? 'grab' : 'default';
            return;
        }

        // 점(vertex) 드래그 종료
        if (this.isVertexDragging) {
            this.isVertexDragging = false;
            this.saveState();
            return;
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.saveState();
            return;
        }

        if (this.isDrawing) {
            if (this.currentTool === 'measure' && this.drawStart) {
                // Just clear - measure is temporary
            } else if (this.currentTool === 'ai-generate' && this.drawStart) {
                // AI 생성 영역
                this.handleAIGenerate(this.drawStart, snapped);
            } else if (this.currentTool === 'wall-diag' && this.drawStart) {
                this.createDiagonalWall(this.drawStart, snapped);
            } else if (this.drawStart) {
                this.createObject(this.drawStart, snapped);
            }
        }

        this.isDrawing = false;
        this.drawStart = null;
        this.clearUI();
        this.render();
    }

    onWheel(e) {
        e.preventDefault();
        const rect = this.mainCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        const worldBefore = this.screenToWorld(mx, my);
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.camera.zoom = Math.max(0.1, Math.min(5, this.camera.zoom * factor));
        const worldAfter = this.screenToWorld(mx, my);
        
        this.camera.x += (worldAfter.x - worldBefore.x) * this.camera.zoom;
        this.camera.y += (worldAfter.y - worldBefore.y) * this.camera.zoom;
        
        document.getElementById('zoomLevel').textContent = Math.round(this.camera.zoom * 100) + '%';
        this.renderGrid();
        this.render();
    }

    onDoubleClick(e) {
        if (['sightline', 'path'].includes(this.currentTool) && this.pathPoints.length >= 2) {
            this.createPathObject();
        } else if (this.currentTool === 'polywall' && this.pathPoints.length >= 2) {
            this.createPolyWall();
        } else if (this.currentTool === 'polygon' && this.pathPoints.length >= 3) {
            this.createPolygonFloor();
        } else if (this.currentTool === 'spline' && this.pathPoints.length >= 2) {
            this.createSplineFloor();
        } else if (this.currentTool === 'corridor' && this.corridorStart) {
            // 통로 더블클릭으로 완성
            const rect = this.mainCanvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const world = this.screenToWorld(sx, sy);
            this.handleCorridorClick(world.x, world.y, true);
        }
    }

    onKeyDown(e) {
        // Global shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': 
                    e.preventDefault(); 
                    // 다각형/스플라인 그리는 중이면 점 단위 undo
                    if (['polygon', 'spline'].includes(this.currentTool) && this.pathPoints.length > 0) {
                        e.shiftKey ? this.redoPathPoint() : this.undoPathPoint();
                    } else {
                        e.shiftKey ? this.redo() : this.undo();
                    }
                    return;
                case 'y': 
                    e.preventDefault(); 
                    // 다각형/스플라인 그리는 중이면 점 단위 redo
                    if (['polygon', 'spline'].includes(this.currentTool) && (this.pathPoints.length > 0 || this.pathPointsRedo.length > 0)) {
                        this.redoPathPoint();
                    } else {
                        this.redo();
                    }
                    return;
                case 's': e.preventDefault(); this.exportFBXWithBatch(); return;
                case 'o': e.preventDefault(); document.getElementById('fileInput').click(); return;
                // case 'a': e.preventDefault(); this.selectAll(); return;  // 다중 선택 비활성화
            }
        }

        if (e.key === ' ') {
            e.preventDefault();
            if (!this.spacePressed) {
                this.spacePressed = true;
                this.prevTool = this.currentTool;
                this.setTool('pan');
            }
            return;
        }

        // Tool shortcuts
        const toolKeys = {
            'v': 'select',
            'p': 'polygon',  // 다각형 바닥 그리기
            's': 'spline',   // 스플라인 바닥
            'c': 'corridor'  // 통로 연결
        };

        if (toolKeys[e.key.toLowerCase()]) {
            this.setTool(toolKeys[e.key.toLowerCase()]);
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            // 입력 필드에 포커스가 있으면 텍스트 편집으로 처리
            const activeEl = document.activeElement;
            const isInput = activeEl && (
                activeEl.tagName === 'INPUT' || 
                activeEl.tagName === 'TEXTAREA' || 
                activeEl.isContentEditable
            );
            if (!isInput) {
                this.deleteSelected();
            }
        }

        if (e.key === 'Escape') {
            // 경로 연결 모드 취소
            if (this.pathConnectMode) {
                this.cancelPathConnect();
                this.showToast('경로 연결이 취소되었습니다');
                return;
            }
            
            this.clearSelection();
            this.pathPoints = [];
            // Corridor 시작점/경유점 취소
            if (this.corridorStart || this.corridorWaypoints.length > 0) {
                this.corridorStart = null;
                this.corridorWaypoints = [];
                this.showToast('통로 연결이 취소되었습니다');
            }
            this.updateProps();
            this.updateObjectsList();
            this.render();
        }

        // Enter로 다각형/스플라인/통로 완성
        if (e.key === 'Enter') {
            if (this.currentTool === 'polygon' && this.pathPoints.length >= 3) {
                this.createPolygonFloor();
            } else if (this.currentTool === 'spline' && this.pathPoints.length >= 2) {
                this.createSplineFloor();
            } else if (this.currentTool === 'corridor' && this.corridorStart) {
                this.finishCorridor();
            }
        }
    }

    onKeyUp(e) {
        if (e.key === ' ' && this.spacePressed) {
            this.spacePressed = false;
            this.setTool(this.prevTool || 'select');
        }
    }

    // ========== TOOLS & STATE ==========
    setTool(tool) {
        this.currentTool = tool;
        this.pathPoints = [];
        this.pathPointsRedo = [];
        
        // Corridor tool 초기화
        this.corridorStart = null;
        this.corridorWaypoints = [];
        this.corridorHoverEdge = null;
        
        // 그리기 도구 선택 시 선택 상태 초기화 (select/pan 제외)
        if (!['select', 'pan'].includes(tool)) {
            this.clearSelection();
            this.selectedVertices = [];
            this.selectedVertex = null;
            this.updateProps();
            this.updateObjectsList();
        }
        
        // Corridor 도구 선택 시 안내
        if (tool === 'corridor') {
            this.showToast('바닥의 edge를 클릭하여 통로 시작점을 선택하세요');
        }
        
        document.querySelectorAll('.tool-btn, .tool-btn-wide').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === tool);
        });
        this.mainCanvas.style.cursor = tool === 'select' ? 'default' : 
                                        tool === 'pan' ? 'grab' : 'crosshair';
        
        // 스플라인 옵션 표시/숨김
        const splineOpts = document.getElementById('splineOptions');
        if (splineOpts) {
            splineOpts.style.display = tool === 'spline' ? 'block' : 'none';
        }
        
        this.render();
    }


    zoom(factor) {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const worldBefore = this.screenToWorld(cx, cy);
        this.camera.zoom = Math.max(0.1, Math.min(5, this.camera.zoom * factor));
        const worldAfter = this.screenToWorld(cx, cy);
        this.camera.x += (worldAfter.x - worldBefore.x) * this.camera.zoom;
        this.camera.y += (worldAfter.y - worldBefore.y) * this.camera.zoom;
        document.getElementById('zoomLevel').textContent = Math.round(this.camera.zoom * 100) + '%';
        this.renderGrid();
        this.render();
    }

    zoomFit() {
        if (this.objects.length === 0) {
            this.camera = { x: this.width / 2, y: this.height / 2, zoom: 1 };
        } else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            this.objects.forEach(o => {
                let pts = [];
                
                // 객체 타입별로 좌표 추출
                if (o.points && o.points.length > 0) {
                    // polywall 등
                    pts = o.points;
                } else if (o.x1 !== undefined && o.y1 !== undefined) {
                    // wall-diag
                    pts = [
                        { x: o.x1, y: o.y1 },
                        { x: o.x2, y: o.y2 }
                    ];
                } else if (o.x !== undefined && o.y !== undefined) {
                    // 일반 객체
                    pts = [
                        { x: o.x, y: o.y },
                        { x: o.x + (o.width || 0), y: o.y + (o.height || 0) }
                    ];
                }
                
                pts.forEach(p => {
                    if (p && !isNaN(p.x) && !isNaN(p.y)) {
                        minX = Math.min(minX, p.x);
                        minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x);
                        maxY = Math.max(maxY, p.y);
                    }
                });
            });
            
            // 유효한 범위가 없으면 기본값 사용
            if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
                this.camera = { x: this.width / 2, y: this.height / 2, zoom: 1 };
            } else {
                const padding = 80;
                const contentW = maxX - minX + padding * 2;
                const contentH = maxY - minY + padding * 2;
                this.camera.zoom = Math.min(2, Math.min(this.width / contentW, this.height / contentH));
                this.camera.x = this.width / 2 - ((minX + maxX) / 2) * this.camera.zoom;
                this.camera.y = this.height / 2 - ((minY + maxY) / 2) * this.camera.zoom;
            }
        }
        document.getElementById('zoomLevel').textContent = Math.round(this.camera.zoom * 100) + '%';
        this.renderGrid();
        this.render();
    }

    // ========== OBJECT CREATION ==========
    createObject(start, end) {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        
        if (width < 8 && height < 8) return;

        const obj = {
            id: this.nextId++,
            type: this.currentTool,
            floor: this.currentFloor,
            color: this.typeColors[this.currentTool] || '#2d3436',
            x, y, width, height,
            label: ''
        };

        switch (this.currentTool) {
            case 'floor-area':
                obj.category = 'floors';
                obj.floorHeight = this.currentHeight;
                obj.color = this.getFloorColor(this.currentHeight);
                break;
            case 'ramp':
                obj.category = 'floors';
                obj.heightStart = this.currentHeight;
                obj.heightEnd = this.currentHeight + 1;  // 기본 1m 상승
                obj.direction = 'right';  // 기본 방향: 왼쪽→오른쪽
                obj.color = '#8b7355';
                break;
            case 'wall':
            case 'cover-full':
            case 'cover-half':
            case 'door':
            case 'window':
                obj.category = 'walls';
                break;
            case 'zone':
                obj.category = 'zones';
                obj.zoneType = this.currentZoneType;
                obj.color = this.getZoneColor(this.currentZoneType);
                break;
        }

        this.objects.push(obj);
        this.saveState();
        this.updateObjectsList();
    }

    createMarker(x, y) {
        const colors = {
            'spawn-def': '#00b894',   // Defence - 녹색
            'spawn-off': '#d63031',   // Offence - 적색
            'objective': '#ffe66d',   // 거점 - 노랑
            'item': '#a29bfe'
        };
        
        const isSpawn = ['spawn-def', 'spawn-off'].includes(this.currentTool);
        const isObjective = this.currentTool === 'objective';
        const isItem = this.currentTool === 'item';
        
        // Defence/Offence 스폰, Objective는 1개씩만 배치 가능 - 기존 것 삭제
        if (isSpawn || isObjective) {
            this.objects = this.objects.filter(obj => obj.type !== this.currentTool);
        }
        
        // 스폰 영역: 고정 10m x 10m (320px)
        if (isSpawn) {
            const size = this.gridSize * 10;  // 10m 고정
            this.objects.push({
                id: this.nextId++,
                type: this.currentTool,
                category: 'markers',
                floor: this.currentFloor,
                color: colors[this.currentTool],
                x: x - size / 2,
                y: y - size / 2,
                width: size,
                height: size,
                fixedSize: true,  // 크기 고정
                label: this.currentTool === 'spawn-def' ? 'DEFENCE' : 'OFFENCE'
            });
        }
        // 거점 영역: 기본 16m x 16m
        else if (isObjective) {
            const size = this.gridSize * 16;  // 16m 기본
            this.objects.push({
                id: this.nextId++,
                type: this.currentTool,
                category: 'markers',
                floor: this.currentFloor,
                color: colors[this.currentTool],
                x: x - size / 2,
                y: y - size / 2,
                width: size,
                height: size,
                minSize: this.gridSize * 2,  // 최소 2m
                label: 'OBJECTIVE'
            });
        }
        // 아이템은 작은 원형 마커
        else {
            const radius = this.gridSize / 2;
            this.objects.push({
                id: this.nextId++,
                type: this.currentTool,
                category: 'markers',
                floor: this.currentFloor,
                color: colors[this.currentTool],
                x, y,
                radius: radius,
                label: ''
            });
        }

        this.saveState();
        this.updateObjectsList();
    }

    createPathObject() {
        if (this.pathPoints.length < 2) return;

        this.objects.push({
            id: this.nextId++,
            type: this.currentTool,
            category: 'analysis',
            floor: this.currentFloor,
            color: this.currentTool === 'sightline' ? '#00b894' : '#fdcb6e',
            points: [...this.pathPoints],
            x: this.pathPoints[0].x,
            y: this.pathPoints[0].y,
            label: ''
        });

        this.pathPoints = [];
        this.saveState();
        this.updateObjectsList();
    }
    
    createDiagonalWall(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        
        if (length < 8) return;
        
        this.objects.push({
            id: this.nextId++,
            type: 'wall-diag',
            category: 'walls',
            floor: this.currentFloor,
            color: this.typeColors['wall-diag'] || '#2d3436',
            x: start.x,
            y: start.y,
            x2: end.x,
            y2: end.y,
            thickness: this.gridSize / 4,
            label: ''
        });
        
        this.saveState();
        this.updateObjectsList();
    }
    
    createPolyWall() {
        if (this.pathPoints.length < 2) return;
        
        const points = [...this.pathPoints];
        const first = points[0];
        const last = points[points.length - 1];
        
        // 시작점과 끝점이 가까우면 닫힌 폴리곤으로 간주 (2 그리드 이내)
        const closeDistance = this.gridSize * 2;
        const isClosed = points.length >= 3 && 
            Math.hypot(last.x - first.x, last.y - first.y) < closeDistance;
        
        // 닫힌 경우 끝점을 시작점으로 스냅하고 닫기
        if (isClosed) {
            points[points.length - 1] = { x: first.x, y: first.y };
        }
        
        // 폴리벽 생성
        const polywallId = this.nextId++;
        this.objects.push({
            id: polywallId,
            type: 'polywall',
            category: 'walls',
            floor: this.currentFloor,
            color: this.typeColors['polywall'] || '#e0e0e0',
            points: points,
            x: points[0].x,
            y: points[0].y,
            thickness: this.gridSize / 4,
            closed: isClosed,
            label: ''
        });
        
        // 닫힌 폴리곤이면 자동으로 내부에 바닥 생성
        if (isClosed && points.length >= 3) {
            this.createFloorFromPolygon(points, polywallId);
        }
        
        this.pathPoints = [];
        this.saveState();
        this.updateObjectsList();
    }
    
    // 다각형 바닥 영역 생성 (polygon 도구용)
    createPolygonFloor() {
        if (this.pathPoints.length < 3) return;
        
        // Deep copy - 다른 오브젝트와 점 참조 공유 방지
        const points = this.pathPoints.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
        const first = points[0];
        const last = points[points.length - 1];
        
        // 시작점과 끝점이 가까우면 끝점을 시작점으로 스냅
        const closeDistance = this.gridSize * 2;
        if (Math.hypot(last.x - first.x, last.y - first.y) < closeDistance) {
            points[points.length - 1] = { x: first.x, y: first.y };
        }
        
        // 바운딩 박스 계산
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        // 다각형 바닥 생성
        this.objects.push({
            id: this.nextId++,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 60%, 40%, 0.6)',
            points: points,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            floorHeight: this.currentHeight,
            closed: true,
            label: ''
        });
        
        // 새로 만든 오브젝트만 선택 (기존 선택 해제)
        const newId = this.nextId - 1;
        this.select(newId);
        this.selectedVertices = [];
        this.selectedVertex = null;
        
        this.pathPoints = [];
        this.saveState();
        this.updateProps();
        this.updateObjectsList();
        this.render();
        
        console.log(`✅ 다각형 바닥 생성: ${points.length}개 꼭짓점`);
    }
    
    // 스플라인 → 다각형 바닥 생성 (세그먼트 기반)
    createSplineFloor() {
        if (this.pathPoints.length < 2) return;
        
        const width = this.splineWidth;
        const halfW = width / 2;
        // Deep copy - 다른 오브젝트와 점 참조 공유 방지
        const points = this.pathPoints.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
        
        // 각 세그먼트의 오프셋 라인 계산
        const segments = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.001) continue;
            
            // 수직 방향
            const nx = -dy / len * halfW;
            const ny = dx / len * halfW;
            
            segments.push({
                left1: { x: p1.x + nx, y: p1.y + ny },
                left2: { x: p2.x + nx, y: p2.y + ny },
                right1: { x: p1.x - nx, y: p1.y - ny },
                right2: { x: p2.x - nx, y: p2.y - ny }
            });
        }
        
        if (segments.length === 0) {
            this.pathPoints = [];
            this.render();
            return;
        }
        
        // 왼쪽/오른쪽 가장자리 점들 (교차점 계산)
        const leftEdge = [segments[0].left1];
        const rightEdge = [segments[0].right1];
        
        for (let i = 0; i < segments.length - 1; i++) {
            const curr = segments[i];
            const next = segments[i + 1];
            
            // 왼쪽 교차점
            const leftInt = this.lineIntersection(
                curr.left1, curr.left2,
                next.left1, next.left2
            );
            if (leftInt) {
                leftEdge.push({ x: Math.round(leftInt.x), y: Math.round(leftInt.y) });
            } else {
                leftEdge.push({ x: Math.round(curr.left2.x), y: Math.round(curr.left2.y) });
            }
            
            // 오른쪽 교차점
            const rightInt = this.lineIntersection(
                curr.right1, curr.right2,
                next.right1, next.right2
            );
            if (rightInt) {
                rightEdge.push({ x: Math.round(rightInt.x), y: Math.round(rightInt.y) });
            } else {
                rightEdge.push({ x: Math.round(curr.right2.x), y: Math.round(curr.right2.y) });
            }
        }
        
        // 마지막 점 추가
        const lastSeg = segments[segments.length - 1];
        leftEdge.push({ x: Math.round(lastSeg.left2.x), y: Math.round(lastSeg.left2.y) });
        rightEdge.push({ x: Math.round(lastSeg.right2.x), y: Math.round(lastSeg.right2.y) });
        
        // 다각형 점 배열 생성 (왼쪽 + 오른쪽 역순)
        const polyPoints = [...leftEdge, ...rightEdge.reverse()];
        
        if (polyPoints.length < 3) {
            this.pathPoints = [];
            this.render();
            return;
        }
        
        // 바운딩 박스 계산
        const xs = polyPoints.map(p => p.x);
        const ys = polyPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        // polyfloor 생성
        this.objects.push({
            id: this.nextId++,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 60%, 40%, 0.6)',
            points: polyPoints,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            floorHeight: this.currentHeight,
            closed: true,
            label: ''
        });
        
        // 새로 만든 오브젝트만 선택 (기존 선택 해제)
        const newId = this.nextId - 1;
        this.select(newId);
        this.selectedVertices = [];
        this.selectedVertex = null;
        
        this.pathPoints = [];
        this.saveState();
        this.updateProps();
        this.updateObjectsList();
        this.render();
        
        console.log(`✅ 스플라인 바닥 생성: ${polyPoints.length}개 꼭짓점, 너비 ${width / this.gridSize}m`);
    }
    
    // 폴리곤 내부에 바닥 영역 생성
    createFloorFromPolygon(points, linkedWallId = null) {
        // 폴리곤의 바운딩 박스 계산
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        this.objects.push({
            id: this.nextId++,
            type: 'floor-area',
            category: 'floors',
            floor: this.currentFloor,
            color: this.getFloorColor(this.currentHeight),
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            floorHeight: this.currentHeight,
            linkedWallId: linkedWallId,
            label: ''
        });
    }
    
    // 선택된 폴리벽에 바닥 채우기
    fillSelectedPolywallWithFloor() {
        const selected = this.getSelected();
        let created = 0;
        
        selected.forEach(obj => {
            if (obj.type === 'polywall' && obj.points && obj.points.length >= 3) {
                this.createFloorFromPolygon(obj.points, obj.id);
                created++;
            }
        });
        
        if (created > 0) {
            this.saveState();
            this.updateObjectsList();
            this.render();
        }
        
        return created;
    }
    
    // 선택된 벽들로 바닥 채우기
    fillFloorFromSelectedWalls() {
        const selected = this.getSelected();
        const walls = selected.filter(o => 
            o.category === 'walls' || ['wall', 'wall-diag', 'polywall', 'cover-full', 'cover-half'].includes(o.type)
        );
        
        if (walls.length < 2) {
            alert('바닥을 만들려면 2개 이상의 벽을 선택하세요.');
            return;
        }
        
        // 모든 벽의 점들을 수집
        const points = this.collectWallPoints(walls);
        
        if (points.length < 3) {
            alert('유효한 점이 부족합니다.');
            return;
        }
        
        // Convex Hull 계산 (Graham scan)
        const hull = this.convexHull(points);
        
        if (hull.length >= 3) {
            this.createFloorFromPolygon(hull);
            this.saveState();
            this.updateObjectsList();
            this.render();
        }
    }
    
    // 벽들에서 점 수집
    collectWallPoints(walls) {
        const points = [];
        
        walls.forEach(wall => {
            if (wall.type === 'polywall' && wall.points) {
                wall.points.forEach(p => points.push({ x: p.x, y: p.y }));
            } else if (wall.type === 'wall-diag') {
                points.push({ x: wall.x1, y: wall.y1 });
                points.push({ x: wall.x2, y: wall.y2 });
            } else if (wall.x !== undefined && wall.width !== undefined) {
                // 사각형 벽
                points.push({ x: wall.x, y: wall.y });
                points.push({ x: wall.x + wall.width, y: wall.y });
                points.push({ x: wall.x + wall.width, y: wall.y + wall.height });
                points.push({ x: wall.x, y: wall.y + wall.height });
            }
        });
        
        return points;
    }
    
    // 선택된 벽들로 비활성화 영역 생성
    createDeadZoneFromWalls() {
        const selected = this.getSelected();
        const walls = selected.filter(o => 
            o.category === 'walls' || ['wall', 'wall-diag', 'polywall', 'cover-full', 'cover-half'].includes(o.type)
        );
        
        if (walls.length < 2) {
            alert('비활성화 영역을 만들려면 2개 이상의 벽을 선택하세요.');
            return;
        }
        
        const points = this.collectWallPoints(walls);
        
        if (points.length < 3) {
            alert('유효한 점이 부족합니다.');
            return;
        }
        
        const hull = this.convexHull(points);
        
        if (hull.length >= 3) {
            this.createDeadZone(hull);
            this.saveState();
            this.updateObjectsList();
            this.render();
        }
    }
    
    // 비활성화 영역 생성
    createDeadZone(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        this.objects.push({
            id: this.nextId++,
            type: 'dead-zone',
            category: 'zones',
            floor: this.currentFloor,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            points: points,  // 폴리곤 형태 저장
            label: '비활성화 영역'
        });
    }
    
    // Convex Hull 계산 (Graham Scan 알고리즘)
    convexHull(points) {
        if (points.length < 3) return points;
        
        // 가장 아래 왼쪽 점 찾기
        let start = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < points[start].y || 
                (points[i].y === points[start].y && points[i].x < points[start].x)) {
                start = i;
            }
        }
        
        const pivot = points[start];
        
        // 각도 기준 정렬
        const sorted = points
            .filter((_, i) => i !== start)
            .map(p => ({
                point: p,
                angle: Math.atan2(p.y - pivot.y, p.x - pivot.x)
            }))
            .sort((a, b) => a.angle - b.angle)
            .map(p => p.point);
        
        // 스택으로 hull 계산
        const hull = [pivot];
        
        for (const p of sorted) {
            while (hull.length > 1) {
                const top = hull[hull.length - 1];
                const prev = hull[hull.length - 2];
                const cross = (top.x - prev.x) * (p.y - prev.y) - (top.y - prev.y) * (p.x - prev.x);
                if (cross <= 0) {
                    hull.pop();
                } else {
                    break;
                }
            }
            hull.push(p);
        }
        
        return hull;
    }

    getZoneColor(type) {
        const colors = {
            'combat': 'rgba(214, 48, 49, 0.25)',
            'safe': 'rgba(0, 184, 148, 0.25)',
            'flank': 'rgba(225, 112, 85, 0.25)',
            'sniper': 'rgba(108, 92, 231, 0.25)',
            'choke': 'rgba(253, 203, 110, 0.25)'
        };
        return colors[type] || colors.combat;
    }
    
    getFloorColor(height) {
        // 높이에 따라 색상 변화 (다크 모드에 최적화)
        const baseHue = 190;  // 청록 계열
        const saturation = 50;
        const lightness = Math.min(65, Math.max(35, 45 + height * 6));
        return `hsla(${baseHue}, ${saturation}%, ${lightness}%, 0.5)`;
    }
    
    // HSLA 색상을 Hex로 변환 (color picker용)
    floorColorToHex(color) {
        if (!color) return '#4a90a4';
        // hsla나 rgba 파싱
        const match = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
        if (match) {
            const h = parseInt(match[1]) / 360;
            const s = parseInt(match[2]) / 100;
            const l = parseInt(match[3]) / 100;
            
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
            const g = Math.round(hue2rgb(p, q, h) * 255);
            const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
            
            return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        }
        return '#4a90a4';
    }
    
    // Hex를 HSLA 색상으로 변환
    hexToFloorColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        return `hsla(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, 0.6)`;
    }
    
    updateHeightButtons() {
        document.querySelectorAll('.height-btn').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.height) === this.currentHeight);
        });
    }
    
    applyHeightToSelected() {
        // 선택된 점들의 높이 변경
        if (this.selectedVertices.length > 0) {
            this.selectedVertices.forEach(v => {
                const obj = this.objects.find(o => o.id === v.objId);
                if (obj && obj.points && obj.points[v.pointIndex]) {
                    // 점에 z 좌표 추가/업데이트
                    obj.points[v.pointIndex].z = this.currentHeight;
                }
            });
            this.render();
            this.saveState();
            return;
        }
        
        // 선택된 오브젝트 전체의 높이 변경
        const selected = this.getSelected();
        selected.forEach(obj => {
            if (obj.type === 'floor-area') {
                obj.floorHeight = this.currentHeight;
                obj.color = this.getFloorColor(this.currentHeight);
            } else if (obj.type === 'polyfloor') {
                obj.floorHeight = this.currentHeight;
                // 모든 점의 z를 동일하게 설정
                if (obj.points) {
                    obj.points.forEach(p => p.z = this.currentHeight);
                }
            }
        });
        if (selected.length > 0) {
            this.render();
            this.saveState();
        }
    }

    // ========== SELECTION & HIT TEST ==========
    
    // 점(vertex) 히트 테스트 - 오브젝트보다 우선
    hitTestVertex(x, y) {
        const threshold = 12 / this.camera.zoom;  // 줌에 따라 조정
        const floorObjs = this.objects.filter(o => o.floor === this.currentFloor).reverse();
        
        for (const obj of floorObjs) {
            // polyfloor 또는 다른 points 배열을 가진 오브젝트
            if (obj.points && obj.points.length > 0) {
                for (let i = 0; i < obj.points.length; i++) {
                    const p = obj.points[i];
                    const dist = Math.hypot(x - p.x, y - p.y);
                    if (dist < threshold) {
                        return { objId: obj.id, pointIndex: i, obj: obj };
                    }
                }
            }
        }
        return null;
    }
    
    // 다각형 바운딩 박스 재계산
    updatePolyBounds(obj) {
        if (!obj.points || obj.points.length === 0) return;
        
        const xs = obj.points.map(p => p.x);
        const ys = obj.points.map(p => p.y);
        obj.x = Math.min(...xs);
        obj.y = Math.min(...ys);
        obj.width = Math.max(...xs) - obj.x;
        obj.height = Math.max(...ys) - obj.y;
    }
    
    hitTest(x, y) {
        const floorObjs = this.objects.filter(o => o.floor === this.currentFloor).reverse();
        
        for (const obj of floorObjs) {
            if (obj.type === 'wall-diag') {
                // 대각선 벽 히트 테스트
                const dist = this.distToSegment(x, y, { x: obj.x, y: obj.y }, { x: obj.x2, y: obj.y2 });
                if (dist < (obj.thickness || 8) + 5) return obj;
            } else if (obj.type === 'polyfloor' && obj.points) {
                // 다각형 바닥 내부 체크
                if (this.isPointInPolygon(x, y, obj.points)) return obj;
            } else if (obj.points) {
                for (let i = 0; i < obj.points.length - 1; i++) {
                    const threshold = obj.type === 'polywall' ? (obj.thickness || 8) + 5 : 12;
                    if (this.distToSegment(x, y, obj.points[i], obj.points[i+1]) < threshold) {
                        return obj;
                    }
                }
            } else if (obj.radius) {
                const dist = Math.hypot(x - obj.x, y - obj.y);
                if (dist <= obj.radius) return obj;
            } else if (obj.width !== undefined) {
                if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
                    return obj;
                }
            }
        }
        return null;
    }
    
    // 점이 폴리곤 내부에 있는지 체크 (Ray casting algorithm)
    isPointInPolygon(x, y, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    distToSegment(px, py, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;
        return Math.hypot(px - projX, py - projY);
    }

    isInRect(obj, x1, y1, x2, y2) {
        if (obj.radius) {
            return obj.x >= x1 && obj.x <= x2 && obj.y >= y1 && obj.y <= y2;
        }
        if (obj.points) {
            return obj.points.every(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
        }
        return obj.x >= x1 && obj.x + obj.width <= x2 && obj.y >= y1 && obj.y + obj.height <= y2;
    }

    getSelected() {
        // 단일 선택만 반환
        if (this._singleSelectedId === null) return [];
        const obj = this.objects.find(o => o.id === this._singleSelectedId);
        return obj ? [obj] : [];
    }

    selectAll() {
        // 다중 선택 비활성화 - 아무것도 하지 않음
    }

    deleteSelected() {
        if ((this.hasSelection() ? 1 : 0) === 0) return;
        this.objects = this.objects.filter(o => !this.isSelected(o.id));
        this.clearSelection();
        this.saveState();
        this.updateProps();
        this.updateObjectsList();
        this.render();
    }

    // ========== RENDERING ==========
    renderGrid() {
        const ctx = this.gridCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        if (!this.showGrid) return;

        const gs = this.gridSize * this.camera.zoom;
        if (gs < 4) return;

        const startX = this.camera.x % gs;
        const startY = this.camera.y % gs;

        // Minor grid (1m 단위)
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x < this.width; x += gs) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
        }
        for (let y = startY; y < this.height; y += gs) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
        }
        ctx.stroke();

        // Major grid (5m 단위)
        const majorGs = gs * 5;
        const majorStartX = this.camera.x % majorGs;
        const majorStartY = this.camera.y % majorGs;
        
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = majorStartX; x < this.width; x += majorGs) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
        }
        for (let y = majorStartY; y < this.height; y += majorGs) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
        }
        ctx.stroke();

        // Origin axes
        const origin = this.worldToScreen(0, 0);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, this.height);
        ctx.moveTo(0, origin.y);
        ctx.lineTo(this.width, origin.y);
        ctx.stroke();
        
        // 미터 눈금 표시 (5m 마다)
        if (this.camera.zoom > 0.3) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            
            const meterInterval = 5;  // 5m 간격
            const pixelInterval = meterInterval * this.pixelsPerMeter * this.camera.zoom;
            
            // X축 눈금
            for (let x = majorStartX; x < this.width; x += pixelInterval) {
                const worldX = (x - this.camera.x) / this.camera.zoom;
                const meters = Math.round(this.toMeters(worldX));
                if (meters % meterInterval === 0 && Math.abs(meters) > 0) {
                    ctx.fillText(`${meters}m`, x, origin.y + 15);
                }
            }
            
            // Y축 눈금
            ctx.textAlign = 'right';
            for (let y = majorStartY; y < this.height; y += pixelInterval) {
                const worldY = (y - this.camera.y) / this.camera.zoom;
                const meters = Math.round(this.toMeters(worldY));
                if (meters % meterInterval === 0 && Math.abs(meters) > 0) {
                    ctx.fillText(`${meters}m`, origin.x - 5, y + 4);
                }
            }
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Reference image (behind everything)
        this.renderRefImage();
        
        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);
        ctx.scale(this.camera.zoom, this.camera.zoom);

        // Other floors (dimmed)
        ctx.globalAlpha = 0.15;
        this.objects.filter(o => o.floor !== this.currentFloor).forEach(o => this.drawObject(ctx, o));

        // Current floor
        ctx.globalAlpha = 1;
        
        // Draw by category order: floors -> zones -> walls -> markers -> analysis
        const order = ['floors', 'zones', 'walls', 'markers', 'analysis'];
        for (const cat of order) {
            if (!this.layers[cat]) continue;
            this.objects
                .filter(o => o.floor === this.currentFloor && o.category === cat)
                .forEach(o => this.drawObject(ctx, o));
        }
        
        // Uncategorized
        this.objects
            .filter(o => o.floor === this.currentFloor && !o.category)
            .forEach(o => this.drawObject(ctx, o));

        // Selection highlight
        this.getSelected().forEach(o => this.drawSelection(ctx, o));

        // Path preview
        if (this.pathPoints.length > 0) {
            this.drawPathPreview(ctx);
        }
        
        // 스냅 포인트 하이라이트 (다각형/스플라인 도구 사용 시)
        if (['polygon', 'spline'].includes(this.currentTool)) {
            this.drawSnapHighlight(ctx);
        }
        
        // 벽 간 거리 표시
        this.drawWallDistances(ctx);
        
        // 경로 미리보기
        this.drawPreviewPaths(ctx);
        
        // 시뮬레이션 에이전트
        this.renderSimAgents(ctx);
        
        // Sketch strokes
        this.renderSketch(ctx);
        
        // 거리 분석 경로 그리기 (시뮬레이션 중이 아닐 때만)
        if (!this.simRunning) {
            this.drawDistanceAnalysis(ctx);
        }

        ctx.restore();
        
        // Corridor 도구 하이라이트
        if (this.currentTool === 'corridor') {
            this.renderCorridorPreview();
        }
        
        // AI 미리보기 오버레이 (항상 최상단에 그리기)
        if (this.aiPendingObjects && this.aiPendingObjects.length > 0) {
            this.renderAIPreviewOverlay();
        }

        // Update object count
        document.getElementById('objectCount').textContent = this.objects.length;
    }
    
    // Corridor 도구 미리보기 렌더링
    renderCorridorPreview() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // 호버 중인 edge 하이라이트
        if (this.corridorHoverEdge) {
            const edge = this.corridorHoverEdge;
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 4 / this.camera.zoom;
            ctx.beginPath();
            ctx.moveTo(edge.p1.x, edge.p1.y);
            ctx.lineTo(edge.p2.x, edge.p2.y);
            ctx.stroke();
            
            // 연결점 표시
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.arc(edge.point.x, edge.point.y, 8 / this.camera.zoom, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 시작점이 선택되어 있으면 표시
        if (this.corridorStart) {
            const start = this.corridorStart;
            const waypoints = this.corridorWaypoints || [];
            
            // 시작 edge
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 4 / this.camera.zoom;
            ctx.beginPath();
            ctx.moveTo(start.p1.x, start.p1.y);
            ctx.lineTo(start.p2.x, start.p2.y);
            ctx.stroke();
            
            // 시작점
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.arc(start.point.x, start.point.y, 10 / this.camera.zoom, 0, Math.PI * 2);
            ctx.fill();
            
            // 경유점들 및 경로 선
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 3 / this.camera.zoom;
            ctx.beginPath();
            ctx.moveTo(start.point.x, start.point.y);
            
            waypoints.forEach((wp, i) => {
                ctx.lineTo(wp.x, wp.y);
            });
            
            // 마지막 경유점(또는 시작점)에서 마우스까지
            if (this.mouse && this.mouse.worldX !== undefined) {
                ctx.lineTo(this.mouse.worldX, this.mouse.worldY);
            }
            ctx.stroke();
            
            // 경유점 표시
            ctx.fillStyle = '#f39c12';
            waypoints.forEach((wp, i) => {
                ctx.beginPath();
                ctx.arc(wp.x, wp.y, 8 / this.camera.zoom, 0, Math.PI * 2);
                ctx.fill();
                
                // 번호 표시
                ctx.fillStyle = '#fff';
                ctx.font = `${14 / this.camera.zoom}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((i + 1).toString(), wp.x, wp.y);
                ctx.fillStyle = '#f39c12';
            });
            
            // 가이드 점선 (마지막 점에서 마우스까지)
            if (this.mouse && this.mouse.worldX !== undefined) {
                const lastPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : start.point;
                ctx.strokeStyle = 'rgba(243, 156, 18, 0.5)';
                ctx.lineWidth = 2 / this.camera.zoom;
                ctx.setLineDash([10 / this.camera.zoom, 10 / this.camera.zoom]);
                ctx.beginPath();
                ctx.moveTo(lastPoint.x, lastPoint.y);
                ctx.lineTo(this.mouse.worldX, this.mouse.worldY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        ctx.restore();
    }
    
    renderAIPreviewOverlay() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        
        this.aiPendingObjects.forEach((obj, idx) => {
            if (obj.type === 'polyfloor' && obj.points && obj.points.length >= 3) {
                const isSelected = this.aiSelectedIndices?.has(idx);
                
                ctx.beginPath();
                ctx.moveTo(obj.points[0].x, obj.points[0].y);
                obj.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.closePath();
                
                ctx.fillStyle = isSelected ? 'rgba(78, 205, 196, 0.4)' : 'rgba(162, 155, 254, 0.3)';
                ctx.fill();
                
                ctx.strokeStyle = isSelected ? '#4ecdc4' : '#a29bfe';
                ctx.lineWidth = isSelected ? 4 : 2;
                ctx.setLineDash([8, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 레이블
                const cx = obj.points.reduce((s, p) => s + p.x, 0) / obj.points.length;
                const cy = obj.points.reduce((s, p) => s + p.y, 0) / obj.points.length;
                ctx.font = 'bold 14px sans-serif';
                ctx.fillStyle = isSelected ? '#4ecdc4' : '#a29bfe';
                ctx.textAlign = 'center';
                const checkbox = isSelected ? '☑' : '☐';
                ctx.fillText(`${checkbox} ${idx + 1}. ${obj.label || 'floor'}`, cx, cy);
            }
        });
        
        // AI 영역 지정 모드
        if (this.aiAreaSelection) {
            const { startX, startY, endX, endY } = this.aiAreaSelection;
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const w = Math.abs(endX - startX);
            const h = Math.abs(endY - startY);
            
            ctx.fillStyle = 'rgba(255, 193, 7, 0.2)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = '#ffc107';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
        }
        
        ctx.restore();
    }
    
    // 경로 거리 계산 (픽셀 → 미터)
    calculatePathDistance(path) {
        if (!path || path.length < 2) return 0;
        let distance = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i-1].x;
            const dy = path[i].y - path[i-1].y;
            distance += Math.sqrt(dx * dx + dy * dy);
        }
        return distance / this.pixelsPerMeter;
    }
    
    // 직선 거리 계산 (픽셀 → 미터)
    calculateStraightDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy) / this.pixelsPerMeter;
    }
    
    // 거리 분석 데이터 계산 (캐싱)
    updateDistanceAnalysisData() {
        // 스폰과 오브젝티브 찾기
        const defSpawn = this.objects.find(o => o.type === 'spawn-def');
        const offSpawn = this.objects.find(o => o.type === 'spawn-off');
        const objective = this.objects.find(o => o.type === 'objective');
        
        this._analysisData = { defPath: null, offPath: null, defDist: 0, offDist: 0 };
        
        if (!objective) return;
        
        const objCX = objective.x + (objective.width || 0) / 2;
        const objCY = objective.y + (objective.height || 0) / 2;
        
        // NavGrid 빌드 (캐싱)
        if (!this._analysisNavGrid) {
            this._analysisNavGrid = this.buildNavGrid();
        }
        
        // Defence → Objective
        if (defSpawn) {
            const defCX = defSpawn.x + (defSpawn.width || 0) / 2;
            const defCY = defSpawn.y + (defSpawn.height || 0) / 2;
            
            if (this._analysisNavGrid) {
                const path = this.findPath(defCX, defCY, objCX, objCY, this._analysisNavGrid, 0);
                if (path && path.length > 1) {
                    this._analysisData.defPath = path;
                    this._analysisData.defDist = this.calculatePathDistance(path);
                } else {
                    // 경로 없으면 직선
                    this._analysisData.defPath = [{x: defCX, y: defCY}, {x: objCX, y: objCY}];
                    this._analysisData.defDist = this.calculateStraightDistance(defCX, defCY, objCX, objCY);
                    this._analysisData.defStraight = true;
                }
            } else {
                this._analysisData.defPath = [{x: defCX, y: defCY}, {x: objCX, y: objCY}];
                this._analysisData.defDist = this.calculateStraightDistance(defCX, defCY, objCX, objCY);
                this._analysisData.defStraight = true;
            }
        }
        
        // Offence → Objective
        if (offSpawn) {
            const offCX = offSpawn.x + (offSpawn.width || 0) / 2;
            const offCY = offSpawn.y + (offSpawn.height || 0) / 2;
            
            if (this._analysisNavGrid) {
                const path = this.findPath(offCX, offCY, objCX, objCY, this._analysisNavGrid, 0);
                if (path && path.length > 1) {
                    this._analysisData.offPath = path;
                    this._analysisData.offDist = this.calculatePathDistance(path);
                } else {
                    this._analysisData.offPath = [{x: offCX, y: offCY}, {x: objCX, y: objCY}];
                    this._analysisData.offDist = this.calculateStraightDistance(offCX, offCY, objCX, objCY);
                    this._analysisData.offStraight = true;
                }
            } else {
                this._analysisData.offPath = [{x: offCX, y: offCY}, {x: objCX, y: objCY}];
                this._analysisData.offDist = this.calculateStraightDistance(offCX, offCY, objCX, objCY);
                this._analysisData.offStraight = true;
            }
        }
        
        // UI 패널 업데이트
        this.updateDistanceUI();
    }
    
    // UI 패널 업데이트
    updateDistanceUI() {
        const defDistEl = document.getElementById('defDistance');
        const offDistEl = document.getElementById('offDistance');
        if (!defDistEl || !offDistEl) return;
        
        const data = this._analysisData || {};
        
        if (data.defPath) {
            const label = data.defStraight ? '(직선)' : '(경로)';
            defDistEl.innerHTML = `<span style="color:#00b894">DEF:</span> <b>${data.defDist.toFixed(1)}m</b> ${label}`;
        } else {
            defDistEl.textContent = 'DEF: --';
        }
        
        if (data.offPath) {
            const label = data.offStraight ? '(직선)' : '(경로)';
            offDistEl.innerHTML = `<span style="color:#d63031">OFF:</span> <b>${data.offDist.toFixed(1)}m</b> ${label}`;
        } else {
            offDistEl.textContent = 'OFF: --';
        }
    }
    
    // 캔버스에 거리 분석 경로 그리기
    drawDistanceAnalysis(ctx) {
        // 디바운싱된 데이터 계산
        if (!this._analysisDataUpdated) {
            this.updateDistanceAnalysisData();
            this._analysisDataUpdated = true;
            // 100ms 후 다시 업데이트 허용
            setTimeout(() => { this._analysisDataUpdated = false; }, 100);
        }
        
        const data = this._analysisData;
        if (!data) return;
        
        // Defence 경로 그리기 (초록색) - 레이블 1/4 지점
        if (data.defPath && data.defPath.length >= 2) {
            this.drawAnalysisPath(ctx, data.defPath, '#00b894', data.defDist, 'DEF', data.defStraight, 0.25);
        }
        
        // Offence 경로 그리기 (빨간색) - 레이블 3/4 지점
        if (data.offPath && data.offPath.length >= 2) {
            this.drawAnalysisPath(ctx, data.offPath, '#d63031', data.offDist, 'OFF', data.offStraight, 0.75);
        }
        
        // 5초 직선 규칙 경고 표시
        this.drawStraightWarnings(ctx);
    }
    
    // 5초 이상 직선 구간 경고 표시 (5m/s × 5초 = 25m)
    drawStraightWarnings(ctx) {
        const SPEED = 5; // m/s
        const BORING_TIME = 5; // 초
        const WARNING_DISTANCE = SPEED * BORING_TIME * this.pixelsPerMeter; // 25m in pixels
        
        const warnings = [];
        
        // 모든 polyfloor의 변(edge) 분석
        for (const obj of this.objects) {
            if (obj.type !== 'polyfloor' || !obj.points || obj.points.length < 2) continue;
            
            const points = obj.points;
            const len = points.length;
            
            for (let i = 0; i < len; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % len];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const edgeLength = Math.sqrt(dx * dx + dy * dy);
                
                if (edgeLength >= WARNING_DISTANCE) {
                    const meters = edgeLength / this.pixelsPerMeter;
                    const seconds = meters / SPEED;
                    warnings.push({
                        x1: p1.x, y1: p1.y,
                        x2: p2.x, y2: p2.y,
                        length: edgeLength,
                        meters: meters,
                        seconds: seconds,
                        label: obj.label || `Floor ${obj.id}`
                    });
                }
            }
        }
        
        if (warnings.length === 0) return;
        
        ctx.save();
        
        // 경고 구간 그리기
        for (const w of warnings) {
            // 빨간색 굵은 선
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            
            // 점선 오버레이
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([15, 10]);
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 중간 지점에 경고 레이블
            const midX = (w.x1 + w.x2) / 2;
            const midY = (w.y1 + w.y2) / 2;
            
            // 배경
            const text = `⚠ ${w.seconds.toFixed(1)}초 (${w.meters.toFixed(0)}m)`;
            ctx.font = 'bold 12px sans-serif';
            const textWidth = ctx.measureText(text).width;
            
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(midX - textWidth/2 - 8, midY - 12, textWidth + 16, 24);
            
            // 테두리
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.strokeRect(midX - textWidth/2 - 8, midY - 12, textWidth + 16, 24);
            
            // 텍스트
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, midX, midY);
        }
        
        ctx.restore();
    }
    
    // 경로 위의 특정 비율 지점 좌표 계산
    getPointOnPath(path, ratio) {
        if (!path || path.length < 2) return path[0];
        
        // 전체 경로 길이 계산
        let totalLength = 0;
        const segments = [];
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i-1].x;
            const dy = path[i].y - path[i-1].y;
            const len = Math.sqrt(dx * dx + dy * dy);
            segments.push({ start: path[i-1], end: path[i], length: len });
            totalLength += len;
        }
        
        // 목표 거리
        const targetDist = totalLength * ratio;
        let accum = 0;
        
        for (const seg of segments) {
            if (accum + seg.length >= targetDist) {
                // 이 세그먼트 내에 목표 지점 있음
                const t = (targetDist - accum) / seg.length;
                return {
                    x: seg.start.x + (seg.end.x - seg.start.x) * t,
                    y: seg.start.y + (seg.end.y - seg.start.y) * t
                };
            }
            accum += seg.length;
        }
        
        return path[path.length - 1];
    }
    
    // 분석 경로 그리기
    drawAnalysisPath(ctx, path, color, distance, label, isStraight, labelRatio = 0.5) {
        if (!path || path.length < 2) return;
        
        ctx.save();
        
        // 경로 선
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = isStraight ? 2 : 3;
        ctx.setLineDash(isStraight ? [10, 5] : []);
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        
        // 시작점 마커
        ctx.beginPath();
        ctx.arc(path[0].x, path[0].y, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        
        // 끝점 마커 (화살표 느낌)
        const lastIdx = path.length - 1;
        ctx.beginPath();
        ctx.arc(path[lastIdx].x, path[lastIdx].y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe66d';
        ctx.fill();
        
        // 거리 레이블 (경로의 지정된 비율 지점)
        const labelPoint = this.getPointOnPath(path, labelRatio);
        
        // 배경
        const text = `${label}: ${distance.toFixed(1)}m`;
        ctx.font = 'bold 14px sans-serif';
        const textWidth = ctx.measureText(text).width;
        
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(labelPoint.x - textWidth/2 - 6, labelPoint.y - 20, textWidth + 12, 24);
        
        // 테두리
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(labelPoint.x - textWidth/2 - 6, labelPoint.y - 20, textWidth + 12, 24);
        
        // 텍스트
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelPoint.x, labelPoint.y - 8);
        
        ctx.restore();
    }
    
    // NavGrid 캐시 무효화 (floor 변경 시 호출)
    invalidateNavGridCache() {
        this._analysisNavGrid = null;
        this._analysisDataUpdated = false;
        this._analysisData = null;
    }

    drawObject(ctx, obj) {
        ctx.save();

        switch (obj.type) {
            case 'floor-area':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                // 높이 표시
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '11px JetBrains Mono, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const floorH = obj.floorHeight || 0;
                const heightText = floorH >= 0 ? `+${floorH}m` : `${floorH}m`;
                ctx.fillText(heightText, obj.x + obj.width/2, obj.y + obj.height/2);
                break;
                
            case 'ramp':
                // 경사로 방향에 따른 그라디언트
                const dir = obj.direction || 'right';
                let gradient;
                
                if (dir === 'right') {
                    gradient = ctx.createLinearGradient(obj.x, obj.y, obj.x + obj.width, obj.y);
                } else if (dir === 'left') {
                    gradient = ctx.createLinearGradient(obj.x + obj.width, obj.y, obj.x, obj.y);
                } else if (dir === 'down') {
                    gradient = ctx.createLinearGradient(obj.x, obj.y, obj.x, obj.y + obj.height);
                } else { // up
                    gradient = ctx.createLinearGradient(obj.x, obj.y + obj.height, obj.x, obj.y);
                }
                
                gradient.addColorStop(0, this.getFloorColor(obj.heightStart || 0));
                gradient.addColorStop(1, this.getFloorColor(obj.heightEnd || 1));
                ctx.fillStyle = gradient;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                
                // 경사 방향 표시 (화살표)
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                const cx = obj.x + obj.width / 2;
                const cy = obj.y + obj.height / 2;
                const arrowLen = Math.min(obj.width, obj.height) / 2 - 10;
                
                if (dir === 'right') {
                    ctx.moveTo(cx - arrowLen, cy);
                    ctx.lineTo(cx + arrowLen, cy);
                    ctx.lineTo(cx + arrowLen - 10, cy - 8);
                    ctx.moveTo(cx + arrowLen, cy);
                    ctx.lineTo(cx + arrowLen - 10, cy + 8);
                } else if (dir === 'left') {
                    ctx.moveTo(cx + arrowLen, cy);
                    ctx.lineTo(cx - arrowLen, cy);
                    ctx.lineTo(cx - arrowLen + 10, cy - 8);
                    ctx.moveTo(cx - arrowLen, cy);
                    ctx.lineTo(cx - arrowLen + 10, cy + 8);
                } else if (dir === 'down') {
                    ctx.moveTo(cx, cy - arrowLen);
                    ctx.lineTo(cx, cy + arrowLen);
                    ctx.lineTo(cx - 8, cy + arrowLen - 10);
                    ctx.moveTo(cx, cy + arrowLen);
                    ctx.lineTo(cx + 8, cy + arrowLen - 10);
                } else { // up
                    ctx.moveTo(cx, cy + arrowLen);
                    ctx.lineTo(cx, cy - arrowLen);
                    ctx.lineTo(cx - 8, cy - arrowLen + 10);
                    ctx.moveTo(cx, cy - arrowLen);
                    ctx.lineTo(cx + 8, cy - arrowLen + 10);
                }
                ctx.stroke();
                
                // 높이 표시
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '10px JetBrains Mono, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${obj.heightStart || 0}→${obj.heightEnd || 1}m`, cx, cy + 20);
                break;
                
            case 'wall':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                break;

            case 'wall-line':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                break;

            case 'cover-full':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                // Shield pattern
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 3]);
                ctx.strokeRect(obj.x + 3, obj.y + 3, obj.width - 6, obj.height - 6);
                ctx.setLineDash([]);
                break;

            case 'cover-half':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                // Half pattern
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                const stripes = Math.floor(obj.width / 8);
                for (let i = 0; i <= stripes; i++) {
                    const lx = obj.x + (i / stripes) * obj.width;
                    ctx.beginPath();
                    ctx.moveTo(lx, obj.y);
                    ctx.lineTo(lx, obj.y + obj.height);
                    ctx.stroke();
                }
                break;

            case 'door':
                ctx.fillStyle = '#8b5a2b';
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 2;
                ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                // Handle
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(obj.x + obj.width * 0.8, obj.y + obj.height / 2, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'window':
                ctx.fillStyle = 'rgba(135, 206, 235, 0.3)';
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                ctx.strokeStyle = '#87ceeb';
                ctx.lineWidth = 2;
                ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                // Cross
                ctx.beginPath();
                ctx.moveTo(obj.x + obj.width / 2, obj.y);
                ctx.lineTo(obj.x + obj.width / 2, obj.y + obj.height);
                ctx.moveTo(obj.x, obj.y + obj.height / 2);
                ctx.lineTo(obj.x + obj.width, obj.y + obj.height / 2);
                ctx.stroke();
                break;

            case 'zone':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                ctx.strokeStyle = obj.color.replace('0.25', '0.6');
                ctx.lineWidth = 2;
                ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                break;
                
            case 'dead-zone':
                // 비활성화 영역 - 폴리곤 형태로 그리기
                if (obj.points && obj.points.length >= 3) {
                    // 어두운 빗금 패턴으로 채우기
                    ctx.fillStyle = 'rgba(40, 20, 20, 0.7)';
                    ctx.beginPath();
                    ctx.moveTo(obj.points[0].x, obj.points[0].y);
                    for (let i = 1; i < obj.points.length; i++) {
                        ctx.lineTo(obj.points[i].x, obj.points[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                    
                    // 빗금 패턴
                    ctx.save();
                    ctx.clip();
                    ctx.strokeStyle = 'rgba(255, 60, 60, 0.4)';
                    ctx.lineWidth = 1;
                    const spacing = 12;
                    for (let i = obj.x - obj.height; i < obj.x + obj.width + obj.height; i += spacing) {
                        ctx.beginPath();
                        ctx.moveTo(i, obj.y);
                        ctx.lineTo(i + obj.height, obj.y + obj.height);
                        ctx.stroke();
                    }
                    ctx.restore();
                    
                    // 테두리
                    ctx.strokeStyle = '#ff4444';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([8, 4]);
                    ctx.beginPath();
                    ctx.moveTo(obj.points[0].x, obj.points[0].y);
                    for (let i = 1; i < obj.points.length; i++) {
                        ctx.lineTo(obj.points[i].x, obj.points[i].y);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // 라벨
                    ctx.fillStyle = '#ff6666';
                    ctx.font = 'bold 11px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🚫 BLOCKED', obj.x + obj.width/2, obj.y + obj.height/2);
                }
                break;

            case 'spawn-def':
            case 'spawn-off':
            case 'objective':
            case 'item':
                this.drawMarker(ctx, obj);
                break;

            case 'sightline':
            case 'path':
                this.drawPath(ctx, obj);
                break;
                
            case 'wall-diag':
                this.drawDiagonalWall(ctx, obj);
                break;
                
            case 'polywall':
                this.drawPolyWall(ctx, obj);
                break;
                
            case 'polyfloor':
                this.drawPolyFloor(ctx, obj);
                break;
        }

        // Label (polyfloor는 이미 중앙에 그렸으므로 제외)
        if (obj.label && obj.type !== 'polyfloor') {
            // 도형 중심 계산
            let cx, cy, size;
            if (obj.width && obj.height) {
                cx = obj.x + obj.width / 2;
                cy = obj.y + obj.height / 2;
                size = Math.min(obj.width, obj.height);
            } else {
                cx = obj.x;
                cy = obj.y;
                size = 100;
            }
            
            // 폰트 크기 (영역 크기에 비례)
            const fontSize = Math.max(14, Math.min(36, size * 0.25));
            
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 텍스트 외곽선
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 3;
            ctx.strokeText(obj.label, cx, cy);
            
            // 텍스트
            ctx.fillStyle = '#fff';
            ctx.fillText(obj.label, cx, cy);
        }

        ctx.restore();
    }

    drawMarker(ctx, obj) {
        const cx = obj.width !== undefined ? obj.x + obj.width / 2 : obj.x;
        const cy = obj.height !== undefined ? obj.y + obj.height / 2 : obj.y;
        
        // 스폰/거점 - 사각형 영역으로 그리기
        if (obj.width !== undefined && obj.height !== undefined) {
            const isSpawn = obj.type.startsWith('spawn');
            const isObjective = obj.type === 'objective';
            
            // 배경 (반투명)
            ctx.fillStyle = obj.color + '33';
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            
            // 테두리 (점선)
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            ctx.setLineDash([]);
            
            // 내부 패턴
            ctx.strokeStyle = obj.color + '44';
            ctx.lineWidth = 1;
            
            if (isSpawn) {
                // 스폰: 그리드 패턴
                const step = this.gridSize;
                ctx.beginPath();
                for (let px = obj.x + step; px < obj.x + obj.width; px += step) {
                    ctx.moveTo(px, obj.y);
                    ctx.lineTo(px, obj.y + obj.height);
                }
                for (let py = obj.y + step; py < obj.y + obj.height; py += step) {
                    ctx.moveTo(obj.x, py);
                    ctx.lineTo(obj.x + obj.width, py);
                }
                ctx.stroke();
                
                // 스폰 아이콘
                ctx.fillStyle = obj.color;
                ctx.font = 'bold 24px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(obj.type === 'spawn-def' ? '🛡' : '⚔', cx, cy - 8);
            } else if (isObjective) {
                // 거점: 대각선 패턴
                ctx.beginPath();
                ctx.moveTo(obj.x, obj.y);
                ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
                ctx.moveTo(obj.x + obj.width, obj.y);
                ctx.lineTo(obj.x, obj.y + obj.height);
                ctx.stroke();
                
                // 거점 아이콘
                ctx.fillStyle = obj.color;
                ctx.font = 'bold 20px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('★', cx, cy - 8);
            }
            
            // 라벨
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obj.label || obj.type.toUpperCase(), cx, cy + 12);
            
            // 크기 표시 (미터)
            const wMeters = (obj.width / this.pixelsPerMeter).toFixed(1);
            const hMeters = (obj.height / this.pixelsPerMeter).toFixed(1);
            ctx.fillStyle = obj.color + 'aa';
            ctx.font = '9px Inter, sans-serif';
            ctx.fillText(`${wMeters}m × ${hMeters}m`, cx, obj.y + obj.height + 12);
            
            return;
        }
        
        
        // 아이템 - 원형 마커
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.fillStyle = obj.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Icon
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${obj.radius}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◆', obj.x, obj.y);
    }

    drawDiagonalWall(ctx, obj) {
        const dx = obj.x2 - obj.x;
        const dy = obj.y2 - obj.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const thickness = obj.thickness || 8;
        
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(angle);
        
        ctx.fillStyle = obj.color;
        ctx.fillRect(0, -thickness / 2, length, thickness);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, -thickness / 2, length, thickness);
        
        ctx.restore();
    }
    
    drawPolyWall(ctx, obj) {
        if (!obj.points || obj.points.length < 2) return;
        
        const thickness = obj.thickness || 8;
        
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.stroke();
        
        // 외곽선
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = thickness + 2;
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.stroke();
        
        // 내부 다시 그리기
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.stroke();
    }
    
    drawPolyFloor(ctx, obj) {
        if (!obj.points || obj.points.length < 3) return;
        
        const isSelected = this.isSelected(obj.id);
        
        // 평균 높이 계산
        let avgHeight = 0;
        let hasHeightVariation = false;
        let minZ = Infinity, maxZ = -Infinity;
        for (const p of obj.points) {
            const z = p.z || 0;
            avgHeight += z;
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }
        avgHeight /= obj.points.length;
        hasHeightVariation = (maxZ - minZ) > 0.1;
        
        // 색상 결정: 사용자 지정 색상 우선, 없으면 높이 기반
        let baseColor;
        if (obj.color) {
            baseColor = obj.color;
        } else {
            // 높이에 따른 색상 변경 (등고 표현)
            const hue = avgHeight >= 0 ? 180 - avgHeight * 20 : 200 - avgHeight * 10;
            const clampedHue = Math.min(220, Math.max(40, hue));
            const lightness = Math.min(55, Math.max(30, 40 + avgHeight * 2));
            baseColor = `hsla(${clampedHue}, 50%, ${lightness}%, 0.6)`;
        }
        
        // 채우기
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        
        // 경사면 패턴 (높이 변화가 있는 경우)
        if (hasHeightVariation) {
            ctx.save();
            ctx.clip(); // 폴리곤 내부에만 그리기
            
            // 등고선 스타일 패턴
            const step = this.gridSize * 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            
            const minX = Math.min(...obj.points.map(p => p.x));
            const maxX = Math.max(...obj.points.map(p => p.x));
            const minY = Math.min(...obj.points.map(p => p.y));
            const maxY = Math.max(...obj.points.map(p => p.y));
            
            // 대각선 등고선 패턴
            for (let i = minX - (maxY - minY); i < maxX + (maxY - minY); i += step) {
                ctx.beginPath();
                ctx.moveTo(i, minY);
                ctx.lineTo(i + (maxY - minY), maxY);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.restore();
        }
        
        // 외곽선 (선택 시 강조)
        ctx.strokeStyle = isSelected ? '#4ecdc4' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();
        
        // 각 변(edge)의 높이 차이 표시 (경사 표시)
        const points = obj.points;
        const len = points.length;
        for (let i = 0; i < len; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % len];
            const z1 = p1.z || 0;
            const z2 = p2.z || 0;
            const heightDiff = Math.abs(z2 - z1);
            
            if (heightDiff > 0.1) {
                // 경사 표시 - 굵은 선으로 강조
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                
                // 경사 방향 화살표
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = z2 > z1 ? '#e74c3c' : '#3498db'; // 올라가면 빨강, 내려가면 파랑
                ctx.lineWidth = 4;
                ctx.stroke();
                
                // 경사도 레이블
                const slopeDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) / this.pixelsPerMeter;
                const slopeAngle = Math.atan2(heightDiff, slopeDist) * 180 / Math.PI;
                const slopeText = `↗${heightDiff.toFixed(1)}m (${slopeAngle.toFixed(0)}°)`;
                
                ctx.font = 'bold 10px sans-serif';
                const tw = ctx.measureText(slopeText).width;
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillRect(midX - tw/2 - 4, midY - 8, tw + 8, 16);
                ctx.fillStyle = z2 > z1 ? '#ff6b6b' : '#74b9ff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(slopeText, midX, midY);
            }
        }
        
        // 꼭짓점 표시 (선택된 오브젝트는 더 크게, 선택된 점은 다른 색상)
        obj.points.forEach((p, i) => {
            // 이 점이 selectedVertices에 포함되어 있는지 체크
            const isVertexInSelection = this.selectedVertices.some(
                v => v.objId === obj.id && v.pointIndex === i
            );
            
            // 높이가 변경된 점인지 체크
            const hasHeight = p.z !== undefined && p.z !== 0;
            
            ctx.beginPath();
            if (isSelected || isVertexInSelection) {
                // 선택된 오브젝트의 점은 크게
                ctx.arc(p.x, p.y, isVertexInSelection ? 10 : 7, 0, Math.PI * 2);
                ctx.fillStyle = isVertexInSelection ? '#f39c12' : '#4ecdc4';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (hasHeight) {
                // 높이가 있는 점은 강조 표시
                ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#e74c3c';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else {
                // 비선택 오브젝트의 점은 작게
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fill();
            }
            
            // 높이가 있는 점은 항상 높이 표시
            if (hasHeight) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const zText = p.z >= 0 ? `+${p.z}m` : `${p.z}m`;
                
                // 배경 박스
                const textWidth = ctx.measureText(zText).width;
                ctx.fillStyle = 'rgba(231, 76, 60, 0.85)';
                ctx.fillRect(p.x - textWidth/2 - 3, p.y - 22, textWidth + 6, 14);
                
                // 텍스트
                ctx.fillStyle = '#fff';
                ctx.fillText(zText, p.x, p.y - 10);
            }
        });
        
        // 폴리곤 중심 계산
        let sumX = 0, sumY = 0;
        for (const p of obj.points) {
            sumX += p.x;
            sumY += p.y;
        }
        const cx = sumX / obj.points.length;
        const cy = sumY / obj.points.length;
        
        // 폴리곤 크기 계산
        const minX = Math.min(...obj.points.map(p => p.x));
        const maxX = Math.max(...obj.points.map(p => p.x));
        const minY = Math.min(...obj.points.map(p => p.y));
        const maxY = Math.max(...obj.points.map(p => p.y));
        const size = Math.min(maxX - minX, maxY - minY);
        
        // 레이블을 중앙에 크게 표시
        if (obj.label && obj.label.length > 0) {
            // 폰트 크기 계산 (영역 크기에 비례, 최소 16px, 최대 48px)
            const fontSize = Math.max(16, Math.min(48, size * 0.3));
            
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 텍스트 그림자/외곽선 (가독성)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 4;
            ctx.strokeText(obj.label, cx, cy);
            
            // 텍스트
            ctx.fillStyle = '#fff';
            ctx.fillText(obj.label, cx, cy);
        }
        
        // 평균 높이 표시 (0이 아닌 경우)
        if (avgHeight !== 0 || hasHeightVariation) {
            const heightText = hasHeightVariation 
                ? `⛰ ${minZ.toFixed(1)}m ~ ${maxZ.toFixed(1)}m`
                : `⛰ ${avgHeight.toFixed(1)}m`;
            
            ctx.font = 'bold 11px sans-serif';
            const tw = ctx.measureText(heightText).width;
            
            // 레이블 아래에 높이 표시
            const heightY = (obj.label && obj.label.length > 0) ? cy + 20 : cy;
            
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(cx - tw/2 - 6, heightY - 8, tw + 12, 18);
            
            ctx.strokeStyle = avgHeight > 0 ? '#e74c3c' : '#3498db';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - tw/2 - 6, heightY - 8, tw + 12, 18);
            
            ctx.fillStyle = avgHeight > 0 ? '#ff6b6b' : '#74b9ff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(heightText, cx, heightY);
        }
    }
    
    drawPath(ctx, obj) {
        if (!obj.points || obj.points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }

        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 3;
        if (obj.type === 'sightline') {
            ctx.setLineDash([8, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow at end
        const last = obj.points[obj.points.length - 1];
        const prev = obj.points[obj.points.length - 2];
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);

        ctx.save();
        ctx.translate(last.x, last.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-12, -6);
        ctx.lineTo(-12, 6);
        ctx.closePath();
        ctx.fillStyle = obj.color;
        ctx.fill();
        ctx.restore();

        // Points
        obj.points.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#fff' : obj.color;
            ctx.fill();
        });
    }

    drawPathPreview(ctx) {
        if (this.pathPoints.length === 0) return;
        
        const isPolygon = this.currentTool === 'polygon';
        const isPolywall = this.currentTool === 'polywall';
        const isSpline = this.currentTool === 'spline';

        // 스플라인: 두께를 가진 경로 프리뷰
        if (isSpline && this.pathPoints.length >= 2) {
            this.drawSplinePreview(ctx);
            return;
        }

        ctx.beginPath();
        ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
        for (let i = 1; i < this.pathPoints.length; i++) {
            ctx.lineTo(this.pathPoints[i].x, this.pathPoints[i].y);
        }
        
        // 마지막 점에서 현재 마우스(snapped) 위치까지 가이드 라인
        const lastPoint = this.pathPoints[this.pathPoints.length - 1];
        const cursorX = this.mouse.snappedX !== undefined ? this.mouse.snappedX : this.mouse.worldX;
        const cursorY = this.mouse.snappedY !== undefined ? this.mouse.snappedY : this.mouse.worldY;
        // 마우스 위치가 유효할 때만 그리기
        const hasValidCursor = (cursorX !== 0 || cursorY !== 0) && cursorX !== undefined;
        if (hasValidCursor) {
            ctx.lineTo(cursorX, cursorY);
        }

        if (isPolygon) {
            // 다각형 바닥 프리뷰 - 닫힌 형태로 표시
            if (this.pathPoints.length >= 3) {
                // 마우스에서 첫 점까지 닫기
                ctx.lineTo(this.pathPoints[0].x, this.pathPoints[0].y);
            }
            ctx.fillStyle = 'hsla(200, 60%, 40%, 0.3)';
            ctx.fill();
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 2;
        } else if (isPolywall) {
            ctx.strokeStyle = this.typeColors['polywall'] || '#2d3436';
            ctx.lineWidth = this.gridSize / 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        } else {
            ctx.strokeStyle = this.currentTool === 'sightline' ? '#00b894' : '#fdcb6e';
            ctx.lineWidth = 3;
        }
        
        ctx.globalAlpha = 0.8;
        if (this.currentTool === 'sightline') {
            ctx.setLineDash([8, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // 꼭짓점 표시
        this.pathPoints.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, isPolygon ? 6 : 5, 0, Math.PI * 2);
            if (isPolygon) {
                ctx.fillStyle = i === 0 ? '#4ecdc4' : '#fff';
            } else if (isPolywall) {
                ctx.fillStyle = i === 0 ? '#fff' : (this.typeColors['polywall'] || '#2d3436');
            } else {
                ctx.fillStyle = i === 0 ? '#fff' : (this.currentTool === 'sightline' ? '#00b894' : '#fdcb6e');
            }
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        
        // 마우스 위치 점 표시 (반투명) - 유효할 때만
        if (hasValidCursor) {
            ctx.beginPath();
            ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
            ctx.strokeStyle = isPolygon ? '#4ecdc4' : '#f39c12';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // 다각형: 점 개수 표시
        if (isPolygon && this.pathPoints.length > 0) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(`${this.pathPoints.length}점`, this.pathPoints[0].x + 10, this.pathPoints[0].y - 10);
        }
    }
    
    // 스플라인 프리뷰 (두께 있는 경로) - 확정된 점만 폴리곤, 마우스는 확장 미리보기
    drawSplinePreview(ctx) {
        const cursorX = this.mouse.snappedX !== undefined ? this.mouse.snappedX : this.mouse.worldX;
        const cursorY = this.mouse.snappedY !== undefined ? this.mouse.snappedY : this.mouse.worldY;
        const hasValidCursor = (cursorX !== 0 || cursorY !== 0) && cursorX !== undefined;
        
        // 확정된 점들 (마우스 제외)
        const confirmedPoints = [...this.pathPoints];
        const width = this.splineWidth;
        const halfW = width / 2;
        
        // 확정된 점이 2개 이상일 때만 폴리곤 그리기
        if (confirmedPoints.length >= 2) {
            // 각 세그먼트의 오프셋 라인 계산
            const segments = [];
            for (let i = 0; i < confirmedPoints.length - 1; i++) {
                const p1 = confirmedPoints[i];
                const p2 = confirmedPoints[i + 1];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len < 0.001) continue;
                
                const nx = -dy / len * halfW;
                const ny = dx / len * halfW;
                
                segments.push({
                    left1: { x: p1.x + nx, y: p1.y + ny },
                    left2: { x: p2.x + nx, y: p2.y + ny },
                    right1: { x: p1.x - nx, y: p1.y - ny },
                    right2: { x: p2.x - nx, y: p2.y - ny }
                });
            }
            
            if (segments.length > 0) {
                // 왼쪽/오른쪽 가장자리 점들 (교차점 계산)
                const leftEdge = [segments[0].left1];
                const rightEdge = [segments[0].right1];
                
                for (let i = 0; i < segments.length - 1; i++) {
                    const curr = segments[i];
                    const next = segments[i + 1];
                    
                    const leftInt = this.lineIntersection(curr.left1, curr.left2, next.left1, next.left2);
                    leftEdge.push(leftInt || curr.left2);
                    
                    const rightInt = this.lineIntersection(curr.right1, curr.right2, next.right1, next.right2);
                    rightEdge.push(rightInt || curr.right2);
                }
                
                leftEdge.push(segments[segments.length - 1].left2);
                rightEdge.push(segments[segments.length - 1].right2);
                
                // 다각형 채우기
                ctx.beginPath();
                ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
                for (let i = 1; i < leftEdge.length; i++) {
                    ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
                }
                for (let i = rightEdge.length - 1; i >= 0; i--) {
                    ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
                }
                ctx.closePath();
                ctx.fillStyle = 'hsla(35, 70%, 45%, 0.35)';
                ctx.fill();
                
                // 가이드선 (좌우 경계)
                ctx.strokeStyle = '#4ecdc4';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]);
                
                ctx.beginPath();
                ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
                for (let i = 1; i < leftEdge.length; i++) ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(rightEdge[0].x, rightEdge[0].y);
                for (let i = 1; i < rightEdge.length; i++) ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 마우스까지 확장 미리보기 (반투명)
                if (hasValidCursor) {
                    const lastSeg = segments[segments.length - 1];
                    const lastLeft = leftEdge[leftEdge.length - 1];
                    const lastRight = rightEdge[rightEdge.length - 1];
                    const lastPoint = confirmedPoints[confirmedPoints.length - 1];
                    
                    // 마지막 점 → 마우스 방향
                    const dx = cursorX - lastPoint.x;
                    const dy = cursorY - lastPoint.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 1) {
                        const nx = -dy / len * halfW;
                        const ny = dx / len * halfW;
                        
                        const cursorLeft = { x: cursorX + nx, y: cursorY + ny };
                        const cursorRight = { x: cursorX - nx, y: cursorY - ny };
                        
                        // 확장 영역 (더 투명하게)
                        ctx.beginPath();
                        ctx.moveTo(lastLeft.x, lastLeft.y);
                        ctx.lineTo(cursorLeft.x, cursorLeft.y);
                        ctx.lineTo(cursorRight.x, cursorRight.y);
                        ctx.lineTo(lastRight.x, lastRight.y);
                        ctx.closePath();
                        ctx.fillStyle = 'hsla(35, 70%, 45%, 0.2)';
                        ctx.fill();
                        
                        // 확장 가이드선
                        ctx.strokeStyle = 'rgba(78, 205, 196, 0.5)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([8, 4]);
                        ctx.beginPath();
                        ctx.moveTo(lastLeft.x, lastLeft.y);
                        ctx.lineTo(cursorLeft.x, cursorLeft.y);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(lastRight.x, lastRight.y);
                        ctx.lineTo(cursorRight.x, cursorRight.y);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
                
                // 너비 표시선 (첫 점에서)
                ctx.beginPath();
                ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
                ctx.lineTo(rightEdge[0].x, rightEdge[0].y);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 너비 레이블
                const midX = (leftEdge[0].x + rightEdge[0].x) / 2;
                const midY = (leftEdge[0].y + rightEdge[0].y) / 2;
                const widthM = Math.round(width / this.gridSize);
                
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(midX - 18, midY - 10, 36, 20);
                ctx.strokeStyle = '#4ecdc4';
                ctx.lineWidth = 1;
                ctx.strokeRect(midX - 18, midY - 10, 36, 20);
                
                ctx.fillStyle = '#4ecdc4';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${widthM}m`, midX, midY);
                ctx.textAlign = 'left';
            }
        }
        
        // 중심선 (확정된 점들)
        if (confirmedPoints.length >= 1) {
            ctx.beginPath();
            ctx.moveTo(confirmedPoints[0].x, confirmedPoints[0].y);
            for (let i = 1; i < confirmedPoints.length; i++) {
                ctx.lineTo(confirmedPoints[i].x, confirmedPoints[i].y);
            }
            // 마우스까지 연장
            if (hasValidCursor) {
                ctx.lineTo(cursorX, cursorY);
            }
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // 확정된 꼭짓점 표시
        confirmedPoints.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#f39c12' : '#fff';
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        
        
        // 점 개수 표시
        if (confirmedPoints.length > 0) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(`${confirmedPoints.length}점`, confirmedPoints[0].x + 10, confirmedPoints[0].y - 20);
        }
    }
    
    // 두 직선의 교차점 계산
    lineIntersection(p1, p2, p3, p4) {
        const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        if (Math.abs(d) < 0.0001) return null; // 평행
        
        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
        
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    }
    
    // 스플라인 너비 레이블 업데이트
    updateSplineWidthLabel() {
        const label = document.getElementById('splineWidthLabel');
        if (label) {
            label.textContent = `${Math.round(this.splineWidth / this.gridSize)}m`;
        }
    }
    
    // 스냅 가능한 점 하이라이트
    drawSnapHighlight(ctx) {
        const world = this.screenToWorld(this.mouse.x, this.mouse.y);
        
        // 1. 먼저 vertex 스냅 체크
        const vertexSnap = this.snapToVertex(world.x, world.y);
        if (vertexSnap) {
            // 스냅 포인트 강조 표시 (청록색 - vertex)
            ctx.beginPath();
            ctx.arc(vertexSnap.x, vertexSnap.y, 12, 0, Math.PI * 2);
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(vertexSnap.x, vertexSnap.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#4ecdc4';
            ctx.fill();
            
            ctx.fillStyle = '#4ecdc4';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('VERTEX', vertexSnap.x, vertexSnap.y - 18);
            return;
        }
        
        // 2. edge 스냅 체크
        const edgeSnap = this.snapToEdge(world.x, world.y);
        if (edgeSnap) {
            // 스냅 포인트 강조 표시 (주황색 - edge)
            ctx.beginPath();
            ctx.arc(edgeSnap.x, edgeSnap.y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(edgeSnap.x, edgeSnap.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#f39c12';
            ctx.fill();
            
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('EDGE', edgeSnap.x, edgeSnap.y - 16);
        }
    }

    drawSelection(ctx, obj) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        if (obj.type === 'wall-diag') {
            const minX = Math.min(obj.x, obj.x2);
            const minY = Math.min(obj.y, obj.y2);
            const maxX = Math.max(obj.x, obj.x2);
            const maxY = Math.max(obj.y, obj.y2);
            ctx.strokeRect(minX - 8, minY - 8, maxX - minX + 16, maxY - minY + 16);
        } else if (obj.points) {
            const xs = obj.points.map(p => p.x);
            const ys = obj.points.map(p => p.y);
            ctx.strokeRect(
                Math.min(...xs) - 8, Math.min(...ys) - 8,
                Math.max(...xs) - Math.min(...xs) + 16,
                Math.max(...ys) - Math.min(...ys) + 16
            );
        } else if (obj.radius) {
            ctx.strokeRect(obj.x - obj.radius - 6, obj.y - obj.radius - 6, obj.radius * 2 + 12, obj.radius * 2 + 12);
        } else {
            ctx.strokeRect(obj.x - 4, obj.y - 4, obj.width + 8, obj.height + 8);
        }

        ctx.setLineDash([]);
    }
    
    // ========== A* PATHFINDING ==========
    
    // 네비게이션 그리드 생성 (1m = 1셀)
    buildNavGrid() {
        const cellSize = this.gridSize;  // 1m per cell
        const bounds = this.getFloorBounds();
        
        if (!bounds) return null;
        
        const gridWidth = Math.ceil((bounds.maxX - bounds.minX) / cellSize);
        const gridHeight = Math.ceil((bounds.maxY - bounds.minY) / cellSize);
        
        // 그리드 초기화 (0 = 이동 불가, 1 = 이동 가능)
        const grid = [];
        const cost = [];  // 이동 비용 (벽 근처는 비용 높음)
        
        for (let y = 0; y < gridHeight; y++) {
            grid[y] = [];
            cost[y] = [];
            for (let x = 0; x < gridWidth; x++) {
                const worldX = bounds.minX + x * cellSize + cellSize / 2;
                const worldY = bounds.minY + y * cellSize + cellSize / 2;
                grid[y][x] = this.isOnFloor(worldX, worldY) ? 1 : 0;
                cost[y][x] = 1;  // 기본 비용
            }
        }
        
        // 벽 근처 비용 증가 (Wall Cost Penalty)
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (grid[y][x] === 1) {
                    // 주변에 벽(0)이 있으면 이동 비용 증가
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight || grid[ny][nx] === 0) {
                                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                                if (dist === 1) {
                                    cost[y][x] = Math.max(cost[y][x], 5);  // 바로 옆은 비용 5배
                                } else if (dist === 2) {
                                    cost[y][x] = Math.max(cost[y][x], 2);  // 2칸 떨어진 곳은 2배
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return {
            grid,
            cost,
            cellSize,
            offsetX: bounds.minX,
            offsetY: bounds.minY,
            width: gridWidth,
            height: gridHeight
        };
    }
    
    // floor 영역의 바운드 계산
    getFloorBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasFloor = false;
        
        for (const obj of this.objects) {
            if (obj.floor !== this.currentFloor) continue;
            
            if (obj.type === 'floor-area' || obj.type === 'polyfloor' || 
                obj.type === 'spawn-def' || obj.type === 'spawn-off' || obj.type === 'objective') {
                hasFloor = true;
                
                if (obj.type === 'polyfloor' && obj.points) {
                    for (const p of obj.points) {
                        minX = Math.min(minX, p.x);
                        minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x);
                        maxY = Math.max(maxY, p.y);
                    }
                } else if (obj.width && obj.height) {
                    minX = Math.min(minX, obj.x);
                    minY = Math.min(minY, obj.y);
                    maxX = Math.max(maxX, obj.x + obj.width);
                    maxY = Math.max(maxY, obj.y + obj.height);
                }
            }
        }
        
        if (!hasFloor) return null;
        
        // 여유 공간 추가
        const padding = this.gridSize * 2;
        return { 
            minX: minX - padding, 
            minY: minY - padding, 
            maxX: maxX + padding, 
            maxY: maxY + padding 
        };
    }
    
    // 월드 좌표를 그리드 좌표로 변환
    worldToGrid(x, y, navGrid) {
        return {
            x: Math.floor((x - navGrid.offsetX) / navGrid.cellSize),
            y: Math.floor((y - navGrid.offsetY) / navGrid.cellSize)
        };
    }
    
    // 그리드 좌표를 월드 좌표로 변환
    gridToWorld(gx, gy, navGrid) {
        return {
            x: navGrid.offsetX + gx * navGrid.cellSize + navGrid.cellSize / 2,
            y: navGrid.offsetY + gy * navGrid.cellSize + navGrid.cellSize / 2
        };
    }
    
    // 가장 가까운 이동 가능 지점 찾기
    findNearestWalkable(gx, gy, navGrid) {
        const maxRadius = 20;  // 최대 탐색 반경
        
        for (let r = 1; r <= maxRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;  // 테두리만
                    
                    const nx = gx + dx;
                    const ny = gy + dy;
                    
                    if (nx >= 0 && nx < navGrid.width && ny >= 0 && ny < navGrid.height) {
                        if (navGrid.grid[ny][nx] === 1) {
                            return { x: nx, y: ny };
                        }
                    }
                }
            }
        }
        
        return null;
    }
    
    // A* 경로 탐색
    findPath(startX, startY, endX, endY, navGrid, randomFactor = 0) {
        if (!navGrid) return null;
        
        let start = this.worldToGrid(startX, startY, navGrid);
        let end = this.worldToGrid(endX, endY, navGrid);
        
        // 범위 체크
        if (start.x < 0 || start.x >= navGrid.width || start.y < 0 || start.y >= navGrid.height) return null;
        if (end.x < 0 || end.x >= navGrid.width || end.y < 0 || end.y >= navGrid.height) return null;
        
        // 시작점이 이동 불가능하면 가장 가까운 이동 가능 지점 찾기
        if (navGrid.grid[start.y][start.x] === 0) {
            start = this.findNearestWalkable(start.x, start.y, navGrid);
            if (!start) return null;
        }
        
        // 끝점이 이동 불가능하면 가장 가까운 이동 가능 지점 찾기
        if (navGrid.grid[end.y][end.x] === 0) {
            end = this.findNearestWalkable(end.x, end.y, navGrid);
            if (!end) return null;
        }
        
        // 시작점과 끝점이 같으면 빈 경로
        if (start.x === end.x && start.y === end.y) {
            return [this.gridToWorld(start.x, start.y, navGrid)];
        }
        
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const key = (x, y) => `${x},${y}`;
        const heuristic = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);
        
        gScore.set(key(start.x, start.y), 0);
        fScore.set(key(start.x, start.y), heuristic(start.x, start.y, end.x, end.y));
        openSet.push({ x: start.x, y: start.y, f: fScore.get(key(start.x, start.y)) });
        
        // 8방향 이동 (대각선 포함)
        const dirs = [
            { dx: 0, dy: -1, cost: 1 },
            { dx: 1, dy: 0, cost: 1 },
            { dx: 0, dy: 1, cost: 1 },
            { dx: -1, dy: 0, cost: 1 },
            { dx: 1, dy: -1, cost: 1.414 },
            { dx: 1, dy: 1, cost: 1.414 },
            { dx: -1, dy: 1, cost: 1.414 },
            { dx: -1, dy: -1, cost: 1.414 }
        ];
        
        while (openSet.length > 0) {
            // f값이 가장 낮은 노드 선택
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            
            if (current.x === end.x && current.y === end.y) {
                // 경로 재구성
                const path = [];
                let curr = key(current.x, current.y);
                while (cameFrom.has(curr)) {
                    const [cx, cy] = curr.split(',').map(Number);
                    const world = this.gridToWorld(cx, cy, navGrid);
                    path.unshift(world);
                    curr = cameFrom.get(curr);
                }
                return path;
            }
            
            closedSet.add(key(current.x, current.y));
            
            for (const dir of dirs) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const nKey = key(nx, ny);
                
                // 범위 및 이동 가능 여부 체크
                if (nx < 0 || nx >= navGrid.width || ny < 0 || ny >= navGrid.height) continue;
                if (navGrid.grid[ny][nx] === 0) continue;
                if (closedSet.has(nKey)) continue;
                
                // 대각선 이동 시 코너 체크
                if (dir.dx !== 0 && dir.dy !== 0) {
                    if (navGrid.grid[current.y][nx] === 0 || navGrid.grid[ny][current.x] === 0) continue;
                }
                
                // 벽 근처 비용 + 랜덤 요소 추가 (다양한 경로 선택)
                const wallCost = navGrid.cost ? navGrid.cost[ny][nx] : 1;
                const randomCost = randomFactor > 0 ? Math.random() * randomFactor : 0;
                const tentativeG = gScore.get(key(current.x, current.y)) + dir.cost * wallCost + randomCost;
                
                if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
                    cameFrom.set(nKey, key(current.x, current.y));
                    gScore.set(nKey, tentativeG);
                    fScore.set(nKey, tentativeG + heuristic(nx, ny, end.x, end.y));
                    
                    if (!openSet.find(n => n.x === nx && n.y === ny)) {
                        openSet.push({ x: nx, y: ny, f: fScore.get(nKey) });
                    }
                }
            }
        }
        
        return null;  // 경로 없음
    }
    
    // 경로 단순화 (Greedy LOS 방식 - 안전하게)
    simplifyPath(path) {
        if (!path || path.length < 3) return path;
        
        const simplified = [path[0]];
        let current = 0;
        
        while (current < path.length - 1) {
            // 현재 점에서 가장 멀리 볼 수 있는 점 찾기
            let farthest = current + 1;
            
            for (let i = current + 2; i < path.length; i++) {
                if (this.hasLineOfSight(path[current].x, path[current].y, path[i].x, path[i].y)) {
                    farthest = i;
                }
            }
            
            // 가장 멀리 볼 수 있는 점 추가
            simplified.push(path[farthest]);
            current = farthest;
        }
        
        return simplified;
    }
    
    // 두 점 사이에 장애물이 있는지 체크 (Line of Sight)
    hasLineOfSight(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.ceil(dist / (this.gridSize * 0.5));  // 0.5m 간격으로 체크
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            
            if (!this.isOnFloor(x, y)) {
                return false;  // 장애물 발견
            }
        }
        
        return true;  // 경로 clear
    }
    
    // 벽 사이 거리 표시 (좁은 통로 자동 경고)
    drawWallDistances(ctx) {
        const minGap = 4;  // 최소 통로 너비 (미터)
        const warningGap = this.fromMeters(minGap);
        const mergeRadius = 50;  // 이 거리 내의 경고는 병합 (픽셀)
        
        // 현재 층의 모든 벽
        const allWalls = this.objects.filter(o => 
            o.floor === this.currentFloor &&
            (o.category === 'walls' || ['wall', 'wall-diag', 'polywall', 'cover-full', 'cover-half'].includes(o.type))
        );
        
        if (allWalls.length < 2) return;
        
        // 모든 좁은 통로 수집
        const warnings = [];
        
        allWalls.forEach((wall1, i) => {
            const bounds1 = this.getWallBounds(wall1);
            
            for (let j = i + 1; j < allWalls.length; j++) {
                const wall2 = allWalls[j];
                const bounds2 = this.getWallBounds(wall2);
                const distances = this.calculateWallDistances(bounds1, bounds2);
                
                distances.forEach(d => {
                    if (d.distance > 0 && d.distance < warningGap) {
                        warnings.push({
                            x: (d.x1 + d.x2) / 2,
                            y: (d.y1 + d.y2) / 2,
                            x1: d.x1, y1: d.y1,
                            x2: d.x2, y2: d.y2,
                            distance: d.distance,
                            meters: this.toMeters(d.distance)
                        });
                    }
                });
            }
        });
        
        // 위치가 가까운 경고들을 그룹화하고 가장 좁은 것만 유지
        const filtered = [];
        const used = new Set();
        
        warnings.sort((a, b) => a.distance - b.distance);  // 좁은 순으로 정렬
        
        warnings.forEach((w, i) => {
            if (used.has(i)) return;
            
            // 이 경고와 가까운 다른 경고들을 찾아서 그룹화
            for (let j = i + 1; j < warnings.length; j++) {
                if (used.has(j)) continue;
                const dist = Math.hypot(warnings[j].x - w.x, warnings[j].y - w.y);
                if (dist < mergeRadius) {
                    used.add(j);  // 병합됨
                }
            }
            
            filtered.push(w);
            used.add(i);
        });
        
        // 필터링된 경고만 표시
        filtered.forEach(w => {
            // 경고 선
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 라벨
            const text = `⚠ ${w.meters.toFixed(1)}m`;
            ctx.font = 'bold 12px JetBrains Mono, monospace';
            const textWidth = ctx.measureText(text).width + 12;
            
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(w.x - textWidth/2, w.y - 11, textWidth, 22);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, w.x, w.y);
        });
        
        // 선택된 벽이 있으면 주변 거리도 표시
        const selected = this.getSelected().filter(o => 
            o.category === 'walls' || ['wall', 'wall-diag', 'polywall', 'cover-full', 'cover-half'].includes(o.type)
        );
        
        if (selected.length > 0) {
            selected.forEach(selWall => {
                const selBounds = this.getWallBounds(selWall);
                
                allWalls.forEach(otherWall => {
                    if (otherWall.id === selWall.id) return;
                    
                    const otherBounds = this.getWallBounds(otherWall);
                    const distances = this.calculateWallDistances(selBounds, otherBounds);
                    
                    distances.forEach(d => {
                        const distMeters = this.toMeters(d.distance);
                        if (d.distance >= warningGap && d.distance < this.fromMeters(10)) {
                            ctx.strokeStyle = '#4ecdc4';
                            ctx.lineWidth = 1;
                            ctx.setLineDash([4, 4]);
                            ctx.beginPath();
                            ctx.moveTo(d.x1, d.y1);
                            ctx.lineTo(d.x2, d.y2);
                            ctx.stroke();
                            ctx.setLineDash([]);
                            
                            const midX = (d.x1 + d.x2) / 2;
                            const midY = (d.y1 + d.y2) / 2;
                            const text = `${distMeters.toFixed(1)}m`;
                            ctx.font = 'bold 11px JetBrains Mono, monospace';
                            const textWidth = ctx.measureText(text).width + 8;
                            
                            ctx.fillStyle = '#4ecdc4';
                            ctx.fillRect(midX - textWidth/2, midY - 9, textWidth, 18);
                            ctx.fillStyle = '#000';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(text, midX, midY);
                        }
                    });
                });
            });
        }
    }
    
    // 벽의 바운딩 박스 얻기
    getWallBounds(wall) {
        if (wall.type === 'wall-diag') {
            return {
                type: 'line',
                x1: wall.x, y1: wall.y,
                x2: wall.x2, y2: wall.y2,
                thickness: wall.thickness || 8
            };
        } else if (wall.type === 'polywall' && wall.points) {
            return {
                type: 'poly',
                points: wall.points,
                thickness: wall.thickness || 8
            };
        } else {
            return {
                type: 'rect',
                x: wall.x, y: wall.y,
                width: wall.width, height: wall.height
            };
        }
    }
    
    // 두 벽 사이의 거리 계산
    calculateWallDistances(bounds1, bounds2) {
        const distances = [];
        
        if (bounds1.type === 'rect' && bounds2.type === 'rect') {
            const r1 = bounds1;
            const r2 = bounds2;
            
            // 수평 거리 (좌우)
            if (this.rangesOverlap(r1.y, r1.y + r1.height, r2.y, r2.y + r2.height)) {
                const overlapY1 = Math.max(r1.y, r2.y);
                const overlapY2 = Math.min(r1.y + r1.height, r2.y + r2.height);
                const midY = (overlapY1 + overlapY2) / 2;
                
                // r1이 왼쪽, r2가 오른쪽
                if (r1.x + r1.width < r2.x) {
                    distances.push({
                        x1: r1.x + r1.width, y1: midY,
                        x2: r2.x, y2: midY,
                        distance: r2.x - (r1.x + r1.width)
                    });
                }
                // r2가 왼쪽, r1이 오른쪽
                if (r2.x + r2.width < r1.x) {
                    distances.push({
                        x1: r2.x + r2.width, y1: midY,
                        x2: r1.x, y2: midY,
                        distance: r1.x - (r2.x + r2.width)
                    });
                }
            }
            
            // 수직 거리 (상하)
            if (this.rangesOverlap(r1.x, r1.x + r1.width, r2.x, r2.x + r2.width)) {
                const overlapX1 = Math.max(r1.x, r2.x);
                const overlapX2 = Math.min(r1.x + r1.width, r2.x + r2.width);
                const midX = (overlapX1 + overlapX2) / 2;
                
                // r1이 위, r2가 아래
                if (r1.y + r1.height < r2.y) {
                    distances.push({
                        x1: midX, y1: r1.y + r1.height,
                        x2: midX, y2: r2.y,
                        distance: r2.y - (r1.y + r1.height)
                    });
                }
                // r2가 위, r1이 아래
                if (r2.y + r2.height < r1.y) {
                    distances.push({
                        x1: midX, y1: r2.y + r2.height,
                        x2: midX, y2: r1.y,
                        distance: r1.y - (r2.y + r2.height)
                    });
                }
            }
        } else if (bounds1.type === 'line' || bounds2.type === 'line') {
            // 대각선 벽과의 거리는 중심점 기준으로 계산
            const center1 = this.getBoundsCenter(bounds1);
            const center2 = this.getBoundsCenter(bounds2);
            const dist = Math.hypot(center2.x - center1.x, center2.y - center1.y);
            
            if (dist > 0) {
                distances.push({
                    x1: center1.x, y1: center1.y,
                    x2: center2.x, y2: center2.y,
                    distance: dist - 20  // 벽 두께 고려
                });
            }
        }
        
        return distances;
    }
    
    // 범위 겹침 체크
    rangesOverlap(a1, a2, b1, b2) {
        return Math.max(a1, b1) < Math.min(a2, b2);
    }
    
    // 바운드의 중심점 구하기
    getBoundsCenter(bounds) {
        if (bounds.type === 'rect') {
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        } else if (bounds.type === 'line') {
            return { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 };
        } else if (bounds.type === 'poly' && bounds.points) {
            const xs = bounds.points.map(p => p.x);
            const ys = bounds.points.map(p => p.y);
            return { 
                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                y: (Math.min(...ys) + Math.max(...ys)) / 2
            };
        }
        return { x: 0, y: 0 };
    }

    renderUI(snapped) {
        const ctx = this.uiCtx;
        ctx.clearRect(0, 0, this.width, this.height);

        if (!this.isDrawing || !this.drawStart) return;

        if (this.currentTool === 'select') {
            // Selection box
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
            const x = Math.min(this.drawStart.x, this.mouse.x);
            const y = Math.min(this.drawStart.y, this.mouse.y);
            const w = Math.abs(this.mouse.x - this.drawStart.x);
            const h = Math.abs(this.mouse.y - this.drawStart.y);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
        } else if (this.currentTool === 'measure') {
            // Measurement line
            const start = this.worldToScreen(this.drawStart.x, this.drawStart.y);
            const end = this.worldToScreen(snapped.x, snapped.y);
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Distance (미터 단위)
            const dist = Math.hypot(snapped.x - this.drawStart.x, snapped.y - this.drawStart.y);
            const distMeters = this.toMeters(dist).toFixed(1);
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            
            ctx.fillStyle = '#6366f1';
            ctx.fillRect(midX - 30, midY - 12, 60, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '11px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${distMeters}m`, midX, midY);
        } else if (this.currentTool === 'wall-diag') {
            // 대각선 벽 미리보기
            const start = this.worldToScreen(this.drawStart.x, this.drawStart.y);
            const end = this.worldToScreen(snapped.x, snapped.y);
            
            ctx.strokeStyle = this.typeColors['wall-diag'] || '#2d3436';
            ctx.lineWidth = (this.gridSize / 4) * this.camera.zoom;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            
            // 길이 표시
            const dist = Math.hypot(snapped.x - this.drawStart.x, snapped.y - this.drawStart.y);
            const distMeters = this.toMeters(dist).toFixed(1);
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(midX - 25, midY - 22, 50, 18);
            ctx.fillStyle = '#fff';
            ctx.font = '11px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${distMeters}m`, midX, midY - 13);
        } else if (this.currentTool === 'ai-generate') {
            // AI 생성 영역 미리보기
            const startScreen = this.worldToScreen(this.drawStart.x, this.drawStart.y);
            const endScreen = this.worldToScreen(snapped.x, snapped.y);
            
            const x = Math.min(startScreen.x, endScreen.x);
            const y = Math.min(startScreen.y, endScreen.y);
            const w = Math.abs(endScreen.x - startScreen.x);
            const h = Math.abs(endScreen.y - startScreen.y);
            
            // 보라색 그라데이션 효과
            const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
            gradient.addColorStop(0, 'rgba(162, 155, 254, 0.2)');
            gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.2)');
            gradient.addColorStop(1, 'rgba(162, 155, 254, 0.2)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, w, h);
            
            // 대시 테두리
            ctx.strokeStyle = '#a29bfe';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
            
            // AI 아이콘과 모드 표시
            const aiMode = document.getElementById('aiModeSelect')?.value || 'fill';
            const modeLabels = {
                'fill': '영역 채우기',
                'corridor': '통로 생성',
                'room': '방 생성',
                'cover': '커버 배치',
                'optimize': '구조 최적화'
            };
            
            ctx.fillStyle = 'rgba(162, 155, 254, 0.9)';
            ctx.fillRect(x, y - 26, 120, 22);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`✨ AI: ${modeLabels[aiMode]}`, x + 6, y - 15);
            
            // 크기 표시
            const worldW = this.toMeters(Math.abs(snapped.x - this.drawStart.x)).toFixed(0);
            const worldH = this.toMeters(Math.abs(snapped.y - this.drawStart.y)).toFixed(0);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x + w - 70, y + h + 4, 66, 20);
            ctx.fillStyle = '#a29bfe';
            ctx.font = '11px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText(`${worldW}m × ${worldH}m`, x + w - 37, y + h + 14);
        } else {
            // Preview shape
            const startScreen = this.worldToScreen(this.drawStart.x, this.drawStart.y);
            const endScreen = this.worldToScreen(snapped.x, snapped.y);
            
            const x = Math.min(startScreen.x, endScreen.x);
            const y = Math.min(startScreen.y, endScreen.y);
            const w = Math.abs(endScreen.x - startScreen.x);
            const h = Math.abs(endScreen.y - startScreen.y);

            const toolColor = this.typeColors[this.currentTool] || '#2d3436';
            ctx.fillStyle = this.currentTool === 'zone' 
                ? this.getZoneColor(this.currentZoneType)
                : toolColor + '66';
            ctx.strokeStyle = toolColor;
            ctx.lineWidth = 2;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);

            // Size label
            const worldW = Math.abs(snapped.x - this.drawStart.x);
            const worldH = Math.abs(snapped.y - this.drawStart.y);
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(x, y - 22, 70, 18);
            ctx.fillStyle = '#fff';
            ctx.font = '11px JetBrains Mono';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${worldW} × ${worldH}`, x + 4, y - 13);
        }
    }

    clearUI() {
        this.uiCtx.clearRect(0, 0, this.width, this.height);
    }

    // ========== UI UPDATES ==========
    updateProps() {
        const container = document.getElementById('propsContent');
        const selected = this.getSelected();

        if (selected.length === 0) {
            container.innerHTML = `
                <div class="props-empty">
                    <i class="fa-solid fa-cube"></i>
                    <p>오브젝트를 선택하세요</p>
                </div>`;
            document.getElementById('objectInfo').textContent = '-';
            return;
        }

        document.getElementById('objectInfo').textContent = `${selected.length}개 선택됨`;

        if (selected.length === 1) {
            const obj = selected[0];
            container.innerHTML = `
                <div class="props-form">
                    <div class="props-field">
                        <label>타입</label>
                        <input type="text" value="${obj.type}" readonly>
                    </div>
                    <div class="props-field">
                        <label>라벨</label>
                        <input type="text" id="propLabel" placeholder="이름 입력...">
                    </div>
                    <div class="props-field-row">
                        <div class="props-field">
                            <label>X (m)</label>
                            <input type="number" id="propX" value="${(obj.x / this.pixelsPerMeter).toFixed(1)}" step="0.5">
                        </div>
                        <div class="props-field">
                            <label>Y (m)</label>
                            <input type="number" id="propY" value="${(obj.y / this.pixelsPerMeter).toFixed(1)}" step="0.5">
                        </div>
                    </div>
                    ${obj.width !== undefined ? `
                    <div class="props-field-row">
                        <div class="props-field">
                            <label>가로 (m)</label>
                            <input type="number" id="propW" value="${(obj.width / this.pixelsPerMeter).toFixed(1)}" step="0.5" ${obj.fixedSize ? 'readonly' : ''}>
                        </div>
                        <div class="props-field">
                            <label>세로 (m)</label>
                            <input type="number" id="propH" value="${(obj.height / this.pixelsPerMeter).toFixed(1)}" step="0.5" ${obj.fixedSize ? 'readonly' : ''}>
                        </div>
                    </div>
                    ` : ''}
                    ${obj.type === 'floor-area' || obj.type === 'polyfloor' ? `
                    <div class="props-field">
                        <label>바닥 높이 (m)</label>
                        <input type="number" id="propFloorHeight" value="${obj.type === 'polyfloor' ? (obj.points && obj.points[0] ? (obj.points[0].z || 0) : 0) : (obj.floorHeight || 0)}" step="0.5">
                        ${obj.type === 'polyfloor' ? '<small style="color:#888;font-size:10px;">모든 점 높이 일괄 변경</small>' : ''}
                    </div>
                    <div class="props-field">
                        <label>바닥 색상</label>
                        <div class="floor-color-btns">
                            <button class="color-btn" data-color="normal" style="background:hsla(200,60%,40%,0.8)" title="일반 통로"></button>
                            <button class="color-btn" data-color="blocked" style="background:hsla(0,60%,40%,0.8)" title="막힌 길"></button>
                            <button class="color-btn" data-color="danger" style="background:hsla(30,80%,50%,0.8)" title="위험 구역"></button>
                            <button class="color-btn" data-color="safe" style="background:hsla(120,50%,40%,0.8)" title="안전 구역"></button>
                            <button class="color-btn" data-color="highlight" style="background:hsla(280,60%,50%,0.8)" title="중요 구역"></button>
                            <input type="color" id="propCustomColor" value="${this.floorColorToHex(obj.color)}" title="커스텀 색상">
                        </div>
                    </div>
                    ` : ''}
                    ${obj.type === 'ramp' ? `
                    <div class="props-field-row">
                        <div class="props-field">
                            <label>시작 (m)</label>
                            <input type="number" id="propRampStart" value="${obj.heightStart || 0}" step="0.5">
                        </div>
                        <div class="props-field">
                            <label>끝 (m)</label>
                            <input type="number" id="propRampEnd" value="${obj.heightEnd || 1}" step="0.5">
                        </div>
                    </div>
                    <div class="props-field">
                        <label>경사 방향</label>
                        <div class="ramp-direction-btns">
                            <button class="dir-btn ${obj.direction === 'left' ? 'active' : ''}" data-dir="left">← 좌</button>
                            <button class="dir-btn ${obj.direction === 'right' || !obj.direction ? 'active' : ''}" data-dir="right">→ 우</button>
                            <button class="dir-btn ${obj.direction === 'up' ? 'active' : ''}" data-dir="up">↑ 상</button>
                            <button class="dir-btn ${obj.direction === 'down' ? 'active' : ''}" data-dir="down">↓ 하</button>
                        </div>
                    </div>
                    ` : ''}
                    ${obj.type === 'polywall' ? `
                    <div class="props-field">
                        <button id="fillFloorBtn" class="props-action-btn">🏠 내부 바닥 채우기</button>
                    </div>
                    ` : ''}
                    <div class="props-field">
                        <label>층</label>
                        <input type="text" value="${obj.floor + 1}F" readonly>
                    </div>
                </div>`;

            // Bind events
            const labelInput = document.getElementById('propLabel');
            if (labelInput) {
                labelInput.value = obj.label || '';  // 띄어쓰기 포함 값 직접 설정
                labelInput.addEventListener('change', e => {
                    obj.label = e.target.value;
                    this.render();
                    this.updateObjectsList();
                });
                // input 이벤트로 실시간 반영
                labelInput.addEventListener('input', e => {
                    obj.label = e.target.value;
                    this.render();
                });
            }

            ['propX', 'propY', 'propW', 'propH'].forEach(id => {
                const input = document.getElementById(id);
                input?.addEventListener('change', e => {
                    const val = parseFloat(e.target.value) * this.pixelsPerMeter;  // m -> px
                    if (id === 'propX') obj.x = val;
                    if (id === 'propY') obj.y = val;
                    if (id === 'propW' && !obj.fixedSize) obj.width = val;
                    if (id === 'propH' && !obj.fixedSize) obj.height = val;
                    this.render();
                });
            });
            
            // Floor height (floor-area 및 polyfloor 모두 지원)
            const floorHeightInput = document.getElementById('propFloorHeight');
            if (floorHeightInput) {
                const updateFloorHeight = (e) => {
                    const newHeight = parseFloat(e.target.value) || 0;
                    
                    if (obj.type === 'floor-area') {
                        obj.floorHeight = newHeight;
                        obj.color = this.getFloorColor(obj.floorHeight);
                    } else if (obj.type === 'polyfloor' && obj.points) {
                        // polyfloor는 모든 점의 z를 동일하게 설정
                        obj.points.forEach(p => p.z = newHeight);
                        obj.floorHeight = newHeight;
                    }
                    
                    this.render();
                };
                
                floorHeightInput.addEventListener('change', e => {
                    updateFloorHeight(e);
                    this.saveState();
                });
                // input 이벤트로 실시간 반영
                floorHeightInput.addEventListener('input', updateFloorHeight);
            }
            
            // Ramp heights
            const rampStartInput = document.getElementById('propRampStart');
            rampStartInput?.addEventListener('change', e => {
                obj.heightStart = parseFloat(e.target.value) || 0;
                this.render();
                this.saveState();
            });
            
            const rampEndInput = document.getElementById('propRampEnd');
            rampEndInput?.addEventListener('change', e => {
                obj.heightEnd = parseFloat(e.target.value) || 1;
                this.render();
                this.saveState();
            });
            
            // 경사로 방향 버튼
            document.querySelectorAll('.dir-btn').forEach(btn => {
                btn.addEventListener('click', e => {
                    obj.direction = btn.dataset.dir;
                    document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.render();
                    this.saveState();
                });
            });
            
            // 폴리벽 바닥 채우기 버튼
            const fillFloorBtn = document.getElementById('fillFloorBtn');
            fillFloorBtn?.addEventListener('click', () => {
                const count = this.fillSelectedPolywallWithFloor();
                if (count > 0) {
                    alert(`${count}개의 바닥 영역이 생성되었습니다.`);
                }
            });
            
            // 바닥 색상 버튼
            document.querySelectorAll('.floor-color-btns .color-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const colorType = btn.dataset.color;
                    const colors = {
                        normal: 'hsla(200, 60%, 40%, 0.6)',
                        blocked: 'hsla(0, 60%, 35%, 0.7)',
                        danger: 'hsla(30, 80%, 45%, 0.7)',
                        safe: 'hsla(120, 50%, 35%, 0.6)',
                        highlight: 'hsla(280, 60%, 45%, 0.7)'
                    };
                    obj.color = colors[colorType];
                    obj.colorType = colorType;  // 타입 저장
                    this.saveState();
                    this.render();
                });
            });
            
            // 커스텀 색상
            const customColorInput = document.getElementById('propCustomColor');
            customColorInput?.addEventListener('change', e => {
                obj.color = this.hexToFloorColor(e.target.value);
                obj.colorType = 'custom';
                this.saveState();
                this.render();
            });
        } else {
            // 선택된 것 중 벽이 있는지 확인
            const hasWalls = selected.some(o => 
                o.category === 'walls' || ['wall', 'wall-diag', 'polywall', 'cover-full', 'cover-half'].includes(o.type)
            );
            
            container.innerHTML = `
                <div class="props-form">
                    <div class="props-field">
                        <label>선택됨</label>
                        <input type="text" value="${selected.length}개 오브젝트" readonly>
                    </div>
                    <div class="props-field">
                        <label>일괄 라벨 변경</label>
                        <input type="text" id="propLabelMulti" placeholder="라벨 입력...">
                    </div>
                    ${hasWalls ? `
                    <div class="props-field">
                        <button id="fillFloorFromWallsBtn" class="props-action-btn">🏠 바닥 채우기</button>
                    </div>
                    <div class="props-field">
                        <button id="createDeadZoneBtn" class="props-action-btn props-action-btn-danger">🚫 비활성화 영역</button>
                    </div>
                    ` : ''}
                </div>`;

            document.getElementById('propLabelMulti')?.addEventListener('change', e => {
                selected.forEach(o => o.label = e.target.value);
                this.render();
                this.updateObjectsList();
            });
            
            // 벽 내부 바닥 채우기 버튼
            document.getElementById('fillFloorFromWallsBtn')?.addEventListener('click', () => {
                this.fillFloorFromSelectedWalls();
            });
            
            // 비활성화 영역 생성 버튼
            document.getElementById('createDeadZoneBtn')?.addEventListener('click', () => {
                this.createDeadZoneFromWalls();
            });
        }
        
        // HEIGHT 패널과 동기화 (선택된 오브젝트의 높이를 반영)
        this.syncHeightPanel();
    }
    
    // HEIGHT 패널을 선택된 오브젝트와 동기화
    syncHeightPanel() {
        const selected = this.getSelected();
        const floorHeightInput = document.getElementById('floorHeight');
        if (!floorHeightInput) return;
        
        if (selected.length === 1) {
            const obj = selected[0];
            let height = 0;
            
            if (obj.type === 'floor-area') {
                height = obj.floorHeight || 0;
            } else if (obj.type === 'polyfloor' && obj.points && obj.points.length > 0) {
                // polyfloor는 첫 번째 점의 높이 사용
                height = obj.points[0].z || 0;
            }
            
            floorHeightInput.value = height;
            this.currentHeight = height;
            this.updateHeightButtons();
        }
    }

    updateObjectsList() {
        const list = document.getElementById('objectsList');
        const floorObjs = this.objects.filter(o => o.floor === this.currentFloor);
        
        const icons = {
            'floor-area': 'fa-vector-square', 'ramp': 'fa-sort-up',
            'wall': 'fa-square', 'wall-diag': 'fa-slash', 'polywall': 'fa-draw-polygon',
            'cover-full': 'fa-shield-halved', 'cover-half': 'fa-bars',
            'door': 'fa-door-open', 'window': 'fa-window-maximize',
            'spawn-def': 'fa-shield', 'spawn-off': 'fa-crosshairs',
            'objective': 'fa-star', 'item': 'fa-cube',
            'sightline': 'fa-eye', 'path': 'fa-route', 'zone': 'fa-draw-polygon',
            'dead-zone': 'fa-ban'
        };

        list.innerHTML = floorObjs.map(o => `
            <li class="${this.isSelected(o.id) ? 'selected' : ''}" data-id="${o.id}">
                <i class="fa-solid ${icons[o.type] || 'fa-cube'}"></i>
                <span>${o.label || o.type}</span>
            </li>
        `).join('');

        list.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', e => {
                const id = parseInt(li.dataset.id);
                // 항상 단일 선택
                this.select(id);
                this.updateProps();
                this.updateObjectsList();
                this.render();
            });
        });
    }

    // ========== HISTORY ==========
    saveState() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.stringify(this.objects));
        if (this.history.length > 50) this.history.shift();
        this.historyIndex = this.history.length - 1;
        
        // NavGrid 캐시 무효화
        this.invalidateNavGridCache();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.objects = JSON.parse(this.history[this.historyIndex]);
            this.clearSelection();
            this.invalidateNavGridCache();
            this.updateProps();
            this.updateObjectsList();
            this.render();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.objects = JSON.parse(this.history[this.historyIndex]);
            this.clearSelection();
            this.invalidateNavGridCache();
            this.updateProps();
            this.updateObjectsList();
            this.render();
        }
    }
    
    // 다각형/스플라인 그리는 중 점 단위 undo
    undoPathPoint() {
        if (this.pathPoints.length > 0) {
            const removed = this.pathPoints.pop();
            this.pathPointsRedo.push(removed);
            this.render();
        }
    }
    
    // 다각형/스플라인 그리는 중 점 단위 redo
    redoPathPoint() {
        if (this.pathPointsRedo.length > 0) {
            const restored = this.pathPointsRedo.pop();
            this.pathPoints.push(restored);
            this.render();
        }
    }

    // ========== PROCEDURAL PATH GENERATION ==========
    handleAIGenerate(start, end) {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        
        if (width < this.gridSize * 4 || height < this.gridSize * 4) {
            alert('최소 4m x 4m 영역을 드래그해주세요.');
            return;
        }
        
        // ===== 스폰 규칙 체크 =====
        const rules = window.LevelRules || {};
        if (rules.SPAWN?.required) {
            const spawnResult = this.ensureSpawnsExist();
            if (spawnResult.created) {
                console.log(`✅ 스폰 자동 생성: ${spawnResult.message}`);
            }
        }
        
        // 프로시저럴 패턴 생성 (API 호출 없이 즉시)
        const newObjects = this.generateProceduralPath(x, y, width, height);
        
        if (newObjects && newObjects.length > 0) {
            // 마커와 충돌하는 오브젝트 필터링
            const markers = this.objects.filter(o => 
                o.floor === this.currentFloor &&
                ['spawn-def', 'spawn-off', 'objective', 'item'].includes(o.type)
            );
            
            const validObjects = newObjects.filter(obj => {
                for (const marker of markers) {
                    const mx = marker.x - 32;
                    const my = marker.y - 32;
                    const mw = (marker.width || 320) + 64;
                    const mh = (marker.height || 320) + 64;
                    
                    const ox = obj.x || 0;
                    const oy = obj.y || 0;
                    const ow = obj.width || 64;
                    const oh = obj.height || 64;
                    
                    if (!(ox + ow < mx || ox > mx + mw || oy + oh < my || oy > my + mh)) {
                        return false;
                    }
                }
                return true;
            });
            
            validObjects.forEach(obj => {
                obj.id = this.nextId++;
                obj.floor = this.currentFloor;
                this.objects.push(obj);
            });
            
            this.saveState();
            this.updateObjectsList();
            this.render();
            
            console.log(`생성 완료: ${validObjects.length}개 오브젝트`);
        }
    }
    
    // 스폰이 없으면 자동 생성 (LevelRules.SPAWN 기반)
    ensureSpawnsExist() {
        const rules = window.LevelRules || {};
        const spawnSize = rules.SPAWN?.sizePx || 320;  // 10m = 320px
        const result = { created: false, message: '' };
        
        // 현재 스폰 확인
        const defSpawns = this.objects.filter(o => o.type === 'spawn-def');
        const offSpawns = this.objects.filter(o => o.type === 'spawn-off');
        
        const createdSpawns = [];
        
        // 캔버스 크기 (없으면 기본값)
        const canvasW = this.canvas?.width || this.mainCanvas?.width || 2400;
        const canvasH = this.canvas?.height || this.mainCanvas?.height || 1600;
        
        // 거리 규칙 (픽셀) - 영역 경계 사이의 간격
        const gapDefToObj = rules.DISTANCE?.defenceToObjectivePx || 800;   // 25m 간격
        const gapOffToObj = rules.DISTANCE?.offenceToObjectivePx || 1600;  // 50m 간격
        const objectiveSize = rules.OBJECTIVE?.sizePx || 512;  // 16m
        
        // 레이아웃: [Offence]--50m간격--[Objective]--25m간격--[Defence]
        // 전체 필요 너비 = spawnSize + gapOffToObj + objectiveSize + gapDefToObj + spawnSize
        const totalWidth = spawnSize + gapOffToObj + objectiveSize + gapDefToObj + spawnSize;
        
        // 중앙 정렬을 위한 시작점
        const startX = Math.round((canvasW - totalWidth) / 2);
        const centerY = Math.round(canvasH / 2);
        
        // 각 영역의 X 좌표 (겹치지 않게 배치)
        const offX = startX;                                          // Offence 시작
        const objectiveX = offX + spawnSize + gapOffToObj;            // Objective 시작
        const defX = objectiveX + objectiveSize + gapDefToObj;        // Defence 시작
        
        // Defence Spawn 없으면 생성
        if (defSpawns.length === 0) {
            const defSpawn = {
                id: this.nextId++,
                type: 'spawn-def',
                category: 'markers',
                color: '#27ae60',  // 녹색
                x: defX,
                y: Math.round(centerY - spawnSize / 2),
                width: spawnSize,
                height: spawnSize,
                floor: this.currentFloor,
                label: 'Defence Spawn'
            };
            this.objects.push(defSpawn);
            createdSpawns.push('Defence Spawn');
            
            // 스폰 영역에 바닥도 생성
            this.objects.push({
                id: this.nextId++,
                type: 'floor-area',
                category: 'floors',
                color: 'hsla(120, 40%, 25%, 0.5)',  // 녹색 계열
                x: defSpawn.x,
                y: defSpawn.y,
                width: spawnSize,
                height: spawnSize,
                floorHeight: 0,
                floor: this.currentFloor,
                label: 'Defence Base'
            });
        }
        
        // Offence Spawn 없으면 생성
        if (offSpawns.length === 0) {
            const offSpawn = {
                id: this.nextId++,
                type: 'spawn-off',
                category: 'markers',
                color: '#e74c3c',  // 빨간색
                x: offX,
                y: Math.round(centerY - spawnSize / 2),
                width: spawnSize,
                height: spawnSize,
                floor: this.currentFloor,
                label: 'Offence Spawn'
            };
            this.objects.push(offSpawn);
            createdSpawns.push('Offence Spawn');
            
            // 스폰 영역에 바닥도 생성
            this.objects.push({
                id: this.nextId++,
                type: 'floor-area',
                category: 'floors',
                color: 'hsla(0, 40%, 25%, 0.5)',  // 빨간색 계열
                x: offSpawn.x,
                y: offSpawn.y,
                width: spawnSize,
                height: spawnSize,
                floorHeight: 0,
                floor: this.currentFloor,
                label: 'Offence Base'
            });
        }
        
        // ===== Objective (거점) 생성 =====
        const objectives = this.objects.filter(o => o.type === 'objective');
        
        if (objectives.length === 0) {
            const objective = {
                id: this.nextId++,
                type: 'objective',
                category: 'markers',
                color: '#f39c12',  // 주황색
                x: objectiveX,  // 거리 규칙에 따라 계산된 위치
                y: Math.round(centerY - objectiveSize / 2),
                width: objectiveSize,
                height: objectiveSize,
                floor: this.currentFloor,
                label: 'Objective'
            };
            this.objects.push(objective);
            createdSpawns.push('Objective (거점)');
            
            // 거점 영역에 바닥도 생성
            this.objects.push({
                id: this.nextId++,
                type: 'floor-area',
                category: 'floors',
                color: 'hsla(40, 50%, 30%, 0.5)',  // 주황색 계열
                x: objective.x,
                y: objective.y,
                width: objectiveSize,
                height: objectiveSize,
                floorHeight: 0,
                floor: this.currentFloor,
                label: 'Objective Area'
            });
        }
        
        if (createdSpawns.length > 0) {
            result.created = true;
            result.message = createdSpawns.join(', ') + ' 생성됨';
            
            // 스폰/목표가 생성되면 경로도 자동 생성
            this.generateConnectingPaths();
            
            this.saveState();
            this.updateObjectsList();
            this.render();
        }
        
        return result;
    }
    
    // Offence → Junction → Objective → Defence 경로 자동 생성 (심플 버전)
    generateConnectingPaths() {
        const rules = window.LevelRules || {};
        const CW = rules.CORRIDOR?.standardWidthPx || 160;  // 통로 폭 5m
        const NODE = rules.JUNCTION?.minSizePx || 256;      // 노드 8m
        
        // 마커 찾기
        const offSpawn = this.objects.find(o => o.type === 'spawn-off');
        const defSpawn = this.objects.find(o => o.type === 'spawn-def');
        const objective = this.objects.find(o => o.type === 'objective');
        
        if (!offSpawn || !defSpawn || !objective) return;
        
        // 중심점
        const offCY = offSpawn.y + offSpawn.height / 2;
        const objCY = objective.y + objective.height / 2;
        
        // 거리
        const totalGap = objective.x - (offSpawn.x + offSpawn.width);
        const segment = totalGap / 3;
        
        // Y 분기 오프셋
        const branchY = CW * 1.5;  // 7.5m 상하
        
        // ===== 노드 위치 계산 =====
        const n1x = offSpawn.x + offSpawn.width;                    // 시작
        const n2x = n1x + segment;                                   // 분기점
        const n3x = n2x + segment;                                   // 합류점
        const n4x = objective.x;                                     // 목표
        const n5x = defSpawn.x;                                      // 수비
        
        // ===== 1. 시작 → 분기점 (직선) =====
        this.addFloorArea(n1x, objCY - CW/2, segment, CW, 'Path Start');
        
        // ===== 2. 분기점 노드 =====
        this.addFloorArea(n2x - NODE/2, objCY - NODE/2, NODE, NODE, 'Branch', 'hsla(270, 40%, 30%, 0.5)');
        
        // ===== 3. 상단 경로 =====
        // 분기점에서 위로
        this.addFloorArea(n2x - CW/2, objCY - NODE/2 - branchY, CW, branchY, 'Upper Vert');
        // 상단 수평
        this.addFloorArea(n2x - CW/2, objCY - NODE/2 - branchY - CW, segment + NODE, CW, 'Upper Horiz');
        // 합류점으로 내려옴
        this.addFloorArea(n3x + NODE/2 - CW/2, objCY - NODE/2 - branchY, CW, branchY, 'Upper Down');
        
        // ===== 4. 하단 경로 =====
        // 분기점에서 아래로
        this.addFloorArea(n2x - CW/2, objCY + NODE/2, CW, branchY, 'Lower Vert');
        // 하단 수평
        this.addFloorArea(n2x - CW/2, objCY + NODE/2 + branchY, segment + NODE, CW, 'Lower Horiz');
        // 합류점으로 올라옴
        this.addFloorArea(n3x + NODE/2 - CW/2, objCY + NODE/2, CW, branchY, 'Lower Up');
        
        // ===== 5. 합류점 노드 =====
        this.addFloorArea(n3x, objCY - NODE/2, NODE, NODE, 'Junction', 'hsla(270, 40%, 30%, 0.5)');
        
        // ===== 6. 합류점 → 목표 =====
        const toObjLen = n4x - (n3x + NODE);
        if (toObjLen > 0) {
            this.addFloorArea(n3x + NODE, objCY - CW/2, toObjLen, CW, 'To Objective');
        }
        
        // ===== 7. 목표 → 수비 =====
        const toDefLen = n5x - (n4x + objective.width);
        if (toDefLen > 0) {
            this.addFloorArea(n4x + objective.width, objCY - CW/2, toDefLen, CW, 'To Defence');
        }
        
        console.log('✅ 심플 경로 생성 완료');
    }
    
    // 바닥 영역 추가 헬퍼
    addFloorArea(x, y, w, h, label, color = 'hsla(190, 50%, 30%, 0.5)') {
        if (w <= 0 || h <= 0) return;
        this.objects.push({
            id: this.nextId++,
            type: 'floor-area',
            category: 'floors',
            color: color,
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(w),
            height: Math.round(h),
            floorHeight: 0,
            floor: this.currentFloor,
            label: label
        });
    }
    
    objectIntersectsRect(obj, x1, y1, x2, y2) {
        if (obj.points) {
            return obj.points.some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
        }
        if (obj.x1 !== undefined) {
            return (obj.x1 >= x1 && obj.x1 <= x2 && obj.y1 >= y1 && obj.y1 <= y2) ||
                   (obj.x2 >= x1 && obj.x2 <= x2 && obj.y2 >= y1 && obj.y2 <= y2);
        }
        const ox = obj.x || 0, oy = obj.y || 0;
        const ow = obj.width || obj.radius * 2 || 0;
        const oh = obj.height || obj.radius * 2 || 0;
        return !(ox > x2 || ox + ow < x1 || oy > y2 || oy + oh < y1);
    }
    
    // 영역 경계에서 벽 연결점 찾기
    findConnectionPoints(x, y, width, height) {
        const points = [];
        const tolerance = 48; // 1.5m 허용 오차
        
        this.objects.forEach(obj => {
            if (obj.floor !== this.currentFloor) return;
            if (!['wall', 'wall-diag', 'polywall'].includes(obj.type)) return;
            
            // 일반 벽
            if (obj.type === 'wall') {
                const corners = [
                    { x: obj.x, y: obj.y },
                    { x: obj.x + obj.width, y: obj.y },
                    { x: obj.x, y: obj.y + obj.height },
                    { x: obj.x + obj.width, y: obj.y + obj.height }
                ];
                
                corners.forEach(c => {
                    // 왼쪽 경계
                    if (Math.abs(c.x - x) < tolerance && c.y >= y && c.y <= y + height) {
                        points.push({ x: x, y: c.y, edge: 'left', wallLabel: obj.label });
                    }
                    // 오른쪽 경계
                    if (Math.abs(c.x - (x + width)) < tolerance && c.y >= y && c.y <= y + height) {
                        points.push({ x: x + width, y: c.y, edge: 'right', wallLabel: obj.label });
                    }
                    // 위쪽 경계
                    if (Math.abs(c.y - y) < tolerance && c.x >= x && c.x <= x + width) {
                        points.push({ x: c.x, y: y, edge: 'top', wallLabel: obj.label });
                    }
                    // 아래쪽 경계
                    if (Math.abs(c.y - (y + height)) < tolerance && c.x >= x && c.x <= x + width) {
                        points.push({ x: c.x, y: y + height, edge: 'bottom', wallLabel: obj.label });
                    }
                });
            }
            
            // 대각선 벽
            if (obj.type === 'wall-diag') {
                [{ x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }].forEach(c => {
                    if (Math.abs(c.x - x) < tolerance && c.y >= y && c.y <= y + height) {
                        points.push({ x: x, y: c.y, edge: 'left', wallLabel: obj.label });
                    }
                    if (Math.abs(c.x - (x + width)) < tolerance && c.y >= y && c.y <= y + height) {
                        points.push({ x: x + width, y: c.y, edge: 'right', wallLabel: obj.label });
                    }
                    if (Math.abs(c.y - y) < tolerance && c.x >= x && c.x <= x + width) {
                        points.push({ x: c.x, y: y, edge: 'top', wallLabel: obj.label });
                    }
                    if (Math.abs(c.y - (y + height)) < tolerance && c.x >= x && c.x <= x + width) {
                        points.push({ x: c.x, y: y + height, edge: 'bottom', wallLabel: obj.label });
                    }
                });
            }
            
            // 폴리월
            if (obj.type === 'polywall' && obj.points) {
                obj.points.forEach(c => {
                    if (Math.abs(c.x - x) < tolerance && c.y >= y && c.y <= y + height) {
                        points.push({ x: x, y: c.y, edge: 'left', wallLabel: obj.label });
                    }
                    if (Math.abs(c.x - (x + width)) < tolerance && c.y >= y && c.y <= y + height) {
                        points.push({ x: x + width, y: c.y, edge: 'right', wallLabel: obj.label });
                    }
                    if (Math.abs(c.y - y) < tolerance && c.x >= x && c.x <= x + width) {
                        points.push({ x: c.x, y: y, edge: 'top', wallLabel: obj.label });
                    }
                    if (Math.abs(c.y - (y + height)) < tolerance && c.x >= x && c.x <= x + width) {
                        points.push({ x: c.x, y: y + height, edge: 'bottom', wallLabel: obj.label });
                    }
                });
            }
        });
        
        // 중복 제거 (가까운 점 병합)
        const merged = [];
        points.forEach(p => {
            const existing = merged.find(m => 
                Math.abs(m.x - p.x) < 32 && Math.abs(m.y - p.y) < 32
            );
            if (!existing) merged.push(p);
        });
        
        return merged;
    }
    
    // 두 오브젝트 간 방향 계산
    getDirection(from, to) {
        const fx = from.x + (from.width || 0) / 2;
        const fy = from.y + (from.height || 0) / 2;
        const tx = to.x + (to.width || 0) / 2;
        const ty = to.y + (to.height || 0) / 2;
        
        const dx = tx - fx;
        const dy = ty - fy;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? '오른쪽(→)' : '왼쪽(←)';
        } else {
            return dy > 0 ? '아래(↓)' : '위(↑)';
        }
    }
    
    showAILoading(show) {
        let overlay = document.getElementById('aiLoadingOverlay');
        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'aiLoadingOverlay';
                overlay.className = 'ai-loading-overlay';
                overlay.innerHTML = `
                    <div class="ai-loading-content">
                        <div class="ai-loading-spinner"></div>
                        <div class="ai-loading-text">AI가 레벨을 디자인하는 중...</div>
                    </div>
                `;
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
        } else if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    // 프로시저럴 패턴 생성 (LevelRules 기반)
    generateProceduralPath(x, y, width, height) {
        const objects = [];
        const rules = window.LevelRules || {};
        
        // 규칙에서 값 가져오기
        const WALL = rules.CORRIDOR?.wallThicknessPx || 32;
        const MIN_PASSAGE = rules.CORRIDOR?.minWidthPx || 128;      // 최소 4m
        const PASSAGE = rules.CORRIDOR?.standardWidthPx || 160;     // 표준 5m
        const MAX_PASSAGE = rules.CORRIDOR?.maxWidthPx || 192;      // 최대 6m
        const MAX_STRAIGHT = rules.THREE_SECOND_RULE?.maxStraightPixels || 432;
        
        // 연결점 분석
        const connections = this.findConnectionPoints(x, y, width, height);
        const conByEdge = { left: [], right: [], top: [], bottom: [] };
        connections.forEach(c => conByEdge[c.edge].push(c));
        
        // 인접 바닥 높이
        const heights = this.getAdjacentHeights(x, y, width, height);
        const baseHeight = heights.left ?? heights.right ?? heights.top ?? heights.bottom ?? 0;
        
        // 영역 분석
        const isWide = width > height * 1.3;
        const isTall = height > width * 1.3;
        const numCon = connections.length;
        
        // ===== 3초 룰 체크 =====
        // 직선 통로가 너무 길면 중간에 코너/굴곡 추가
        const needsBreak = (isWide && width > MAX_STRAIGHT) || (isTall && height > MAX_STRAIGHT);
        
        // ===== 3방향 룰 체크 =====
        // 분기점은 최소 3방향 필요
        const isJunction = numCon >= 3;
        
        // 바닥 생성
        objects.push({
            type: 'floor-area',
            category: 'floors',
            color: 'hsla(190, 50%, 30%, 0.5)',
            x, y, width, height,
            floorHeight: baseHeight,
            label: 'Floor'
        });
        
        // 패턴에 따른 벽 생성
        if (numCon === 0) {
            // 독립 공간 - 사방 벽 + 3방향 출입구
            objects.push(...this.createSpaceWithExits(x, y, width, height, WALL, PASSAGE));
        } else if (numCon === 1) {
            // 막다른 방 - 권장하지 않음, 그래도 생성
            objects.push(...this.createRoomWalls(x, y, width, height, WALL, conByEdge));
            console.warn('⚠️ 3방향 룰: 연결점 1개 - 추가 출입구 권장');
        } else if (numCon === 2) {
            // 통로 - 3초 룰 적용
            if (needsBreak) {
                // 긴 통로 → 중간에 굴곡 추가
                objects.push(...this.createCorridorWithBend(x, y, width, height, WALL, PASSAGE, conByEdge));
                console.log('📐 3초 룰: 긴 통로에 굴곡 추가');
            } else if (isWide || (conByEdge.left.length && conByEdge.right.length)) {
                objects.push(...this.createHorizontalCorridor(x, y, width, height, WALL, conByEdge));
            } else if (isTall || (conByEdge.top.length && conByEdge.bottom.length)) {
                objects.push(...this.createVerticalCorridor(x, y, width, height, WALL, conByEdge));
            } else {
                objects.push(...this.createCornerCorridor(x, y, width, height, WALL, conByEdge));
            }
        } else {
            // 분기점 (3개 이상) - 3방향 룰 만족
            objects.push(...this.createJunction(x, y, width, height, WALL, conByEdge));
            console.log('✅ 3방향 룰: 분기점 생성 (연결점 ' + numCon + '개)');
        }
        
        // 높이 차이 있으면 ramp 추가
        this.addRampsForHeightDiff(objects, x, y, width, height, heights, baseHeight);
        
        return objects;
    }
    
    // 독립 공간 + 3방향 출입구
    createSpaceWithExits(x, y, w, h, t, passage) {
        const walls = [];
        const cx = x + w / 2;
        const cy = y + h / 2;
        
        // 3방향 출입구 (좌, 우, 하단)
        // 상단 - 전체 벽
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: w, height: t, label: 'North' });
        
        // 좌측 - 출입구
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: y + t, width: t, height: cy - passage/2 - y - t, label: 'West Top' });
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: cy + passage/2, width: t, height: y + h - t - cy - passage/2, label: 'West Bot' });
        
        // 우측 - 출입구
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - t, y: y + t, width: t, height: cy - passage/2 - y - t, label: 'East Top' });
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - t, y: cy + passage/2, width: t, height: y + h - t - cy - passage/2, label: 'East Bot' });
        
        // 하단 - 출입구
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: y + h - t, width: cx - passage/2 - x, height: t, label: 'South Left' });
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: cx + passage/2, y: y + h - t, width: x + w - cx - passage/2, height: t, label: 'South Right' });
        
        return walls.filter(wall => wall.width > 0 && wall.height > 0);
    }
    
    // 긴 통로에 굴곡 추가 (3초 룰)
    createCorridorWithBend(x, y, w, h, t, passage, conByEdge) {
        const walls = [];
        const isHorizontal = w > h;
        
        if (isHorizontal) {
            // 좌우 통로 - 중간에 S자 굴곡
            const midX = x + w / 2;
            const bendOffset = passage; // 굴곡 오프셋
            
            // 상단 벽 - 중간에 튀어나옴
            const topY = y + (h - passage) / 2;
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: midX - x, height: topY - y, label: 'Top Left' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: midX, y, width: w/2, height: topY - y + bendOffset, label: 'Top Right Bend' });
            
            // 하단 벽 - 중간에 들어감
            const botY = y + (h + passage) / 2;
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: botY - bendOffset, width: midX - x, height: y + h - botY + bendOffset, label: 'Bot Left Bend' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: midX, y: botY, width: w/2, height: y + h - botY, label: 'Bot Right' });
        } else {
            // 상하 통로 - 중간에 S자 굴곡
            const midY = y + h / 2;
            const bendOffset = passage;
            
            const leftX = x + (w - passage) / 2;
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: leftX - x, height: midY - y, label: 'Left Top' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: midY, width: leftX - x + bendOffset, height: h/2, label: 'Left Bot Bend' });
            
            const rightX = x + (w + passage) / 2;
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: rightX - bendOffset, y, width: x + w - rightX + bendOffset, height: midY - y, label: 'Right Top Bend' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: rightX, y: midY, width: x + w - rightX, height: h/2, label: 'Right Bot' });
        }
        
        return walls.filter(wall => wall.width > 0 && wall.height > 0);
    }
    
    getAdjacentHeights(x, y, width, height) {
        const heights = { left: null, right: null, top: null, bottom: null };
        this.objects.filter(o => o.floor === this.currentFloor && o.type === 'floor-area').forEach(f => {
            const fh = f.floorHeight || 0;
            if (f.x + f.width >= x - 32 && f.x + f.width <= x + 32) heights.left = fh;
            if (f.x >= x + width - 32 && f.x <= x + width + 32) heights.right = fh;
            if (f.y + f.height >= y - 32 && f.y + f.height <= y + 32) heights.top = fh;
            if (f.y >= y + height - 32 && f.y <= y + height + 32) heights.bottom = fh;
        });
        return heights;
    }
    
    createBoxWalls(x, y, w, h, t) {
        return [
            { type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: w, height: t, label: 'North' },
            { type: 'wall', category: 'walls', color: '#e0e0e0', x, y: y + h - t, width: w, height: t, label: 'South' },
            { type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: t, height: h, label: 'West' },
            { type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - t, y, width: t, height: h, label: 'East' }
        ];
    }
    
    createRoomWalls(x, y, w, h, t, conByEdge) {
        const walls = [];
        const passage = 160;
        
        // 연결 없는 변에 벽
        if (!conByEdge.top.length) walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: w, height: t, label: 'North' });
        if (!conByEdge.bottom.length) walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: y + h - t, width: w, height: t, label: 'South' });
        if (!conByEdge.left.length) walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: t, height: h, label: 'West' });
        if (!conByEdge.right.length) walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - t, y, width: t, height: h, label: 'East' });
        
        // 연결 있는 변 - 출입구 뚫고 양옆 벽
        ['top', 'bottom', 'left', 'right'].forEach(edge => {
            if (conByEdge[edge].length) {
                walls.push(...this.createWallWithOpening(x, y, w, h, t, edge, passage));
            }
        });
        
        return walls;
    }
    
    createHorizontalCorridor(x, y, w, h, t, conByEdge) {
        const walls = [];
        const cy = y + h / 2;
        const passage = Math.min(160, h - t * 2);
        const topY = cy - passage / 2;
        const botY = cy + passage / 2;
        
        // 상단 벽
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: w, height: topY - y, label: 'Top Wall' });
        // 하단 벽
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: botY, width: w, height: y + h - botY, label: 'Bottom Wall' });
        
        return walls.filter(wall => wall.height > 0 && wall.width > 0);
    }
    
    createVerticalCorridor(x, y, w, h, t, conByEdge) {
        const walls = [];
        const cx = x + w / 2;
        const passage = Math.min(160, w - t * 2);
        const leftX = cx - passage / 2;
        const rightX = cx + passage / 2;
        
        // 좌측 벽
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: leftX - x, height: h, label: 'Left Wall' });
        // 우측 벽
        walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: rightX, y, width: x + w - rightX, height: h, label: 'Right Wall' });
        
        return walls.filter(wall => wall.height > 0 && wall.width > 0);
    }
    
    createCornerCorridor(x, y, w, h, t, conByEdge) {
        const walls = [];
        const passage = 160;
        
        // L자 코너 - 두 연결점 방향에 따라 내부 코너 벽
        const hasLeft = conByEdge.left.length > 0;
        const hasRight = conByEdge.right.length > 0;
        const hasTop = conByEdge.top.length > 0;
        const hasBottom = conByEdge.bottom.length > 0;
        
        if (hasLeft && hasTop) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + passage, y: y + passage, width: w - passage, height: h - passage, label: 'Corner' });
        } else if (hasLeft && hasBottom) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + passage, y, width: w - passage, height: h - passage, label: 'Corner' });
        } else if (hasRight && hasTop) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: y + passage, width: w - passage, height: h - passage, label: 'Corner' });
        } else if (hasRight && hasBottom) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: w - passage, height: h - passage, label: 'Corner' });
        }
        
        return walls;
    }
    
    createJunction(x, y, w, h, t, conByEdge) {
        const walls = [];
        const passage = 160;
        
        // 각 모서리에 벽 블록 배치
        const cornerW = (w - passage) / 2;
        const cornerH = (h - passage) / 2;
        
        // 연결 없는 모서리에만 벽
        if (!conByEdge.left.length || !conByEdge.top.length) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: cornerW, height: cornerH, label: 'NW' });
        }
        if (!conByEdge.right.length || !conByEdge.top.length) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - cornerW, y, width: cornerW, height: cornerH, label: 'NE' });
        }
        if (!conByEdge.left.length || !conByEdge.bottom.length) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: y + h - cornerH, width: cornerW, height: cornerH, label: 'SW' });
        }
        if (!conByEdge.right.length || !conByEdge.bottom.length) {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - cornerW, y: y + h - cornerH, width: cornerW, height: cornerH, label: 'SE' });
        }
        
        return walls.filter(wall => wall.width > 0 && wall.height > 0);
    }
    
    createWallWithOpening(x, y, w, h, t, edge, opening) {
        const walls = [];
        const center = edge === 'top' || edge === 'bottom' ? x + w / 2 : y + h / 2;
        
        if (edge === 'top') {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: center - opening/2 - x, height: t, label: 'Top L' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: center + opening/2, y, width: x + w - center - opening/2, height: t, label: 'Top R' });
        } else if (edge === 'bottom') {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: y + h - t, width: center - opening/2 - x, height: t, label: 'Bot L' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: center + opening/2, y: y + h - t, width: x + w - center - opening/2, height: t, label: 'Bot R' });
        } else if (edge === 'left') {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y, width: t, height: center - opening/2 - y, label: 'Left T' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x, y: center + opening/2, width: t, height: y + h - center - opening/2, label: 'Left B' });
        } else if (edge === 'right') {
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - t, y, width: t, height: center - opening/2 - y, label: 'Right T' });
            walls.push({ type: 'wall', category: 'walls', color: '#e0e0e0', x: x + w - t, y: center + opening/2, width: t, height: y + h - center - opening/2, label: 'Right B' });
        }
        
        return walls.filter(wall => wall.width > 0 && wall.height > 0);
    }
    
    addRampsForHeightDiff(objects, x, y, w, h, heights, baseHeight) {
        const rampSize = 64;
        
        if (heights.left !== null && heights.left !== baseHeight) {
            objects.push({
                type: 'ramp', category: 'floors', color: '#8b7355',
                x, y: y + h/2 - rampSize/2, width: rampSize, height: rampSize,
                heightStart: heights.left, heightEnd: baseHeight,
                direction: heights.left < baseHeight ? 'right' : 'left',
                label: 'Ramp W'
            });
        }
        if (heights.right !== null && heights.right !== baseHeight) {
            objects.push({
                type: 'ramp', category: 'floors', color: '#8b7355',
                x: x + w - rampSize, y: y + h/2 - rampSize/2, width: rampSize, height: rampSize,
                heightStart: baseHeight, heightEnd: heights.right,
                direction: heights.right > baseHeight ? 'right' : 'left',
                label: 'Ramp E'
            });
        }
        if (heights.top !== null && heights.top !== baseHeight) {
            objects.push({
                type: 'ramp', category: 'floors', color: '#8b7355',
                x: x + w/2 - rampSize/2, y, width: rampSize, height: rampSize,
                heightStart: heights.top, heightEnd: baseHeight,
                direction: heights.top < baseHeight ? 'down' : 'up',
                label: 'Ramp N'
            });
        }
        if (heights.bottom !== null && heights.bottom !== baseHeight) {
            objects.push({
                type: 'ramp', category: 'floors', color: '#8b7355',
                x: x + w/2 - rampSize/2, y: y + h - rampSize, width: rampSize, height: rampSize,
                heightStart: baseHeight, heightEnd: heights.bottom,
                direction: heights.bottom > baseHeight ? 'down' : 'up',
                label: 'Ramp S'
            });
        }
    }

    // ========== FILE OPERATIONS ==========
    newProject() {
        if (this.objects.length > 0 && !confirm('현재 프로젝트를 삭제하고 새로 시작할까요?')) return;
        this.levelName = 'Untitled';
        this.objects = [];
        this.clearSelection();
        this.nextId = 1;
        this.historyIndex = -1;
        this.history = [];
        this.updateLevelNameDisplay();
        this.saveState();
        this.updateProps();
        this.updateObjectsList();
        this.render();
    }

    saveFile() {
        const data = {
            version: '2.0',
            gridSize: this.gridSize,
            nextId: this.nextId,
            objects: this.objects
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `level_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // File System Access API로 파일 열기 (폴더 핸들 저장)
    async openFile() {
        if (window.showOpenFilePicker) {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'LEVELFORGE 파일',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                
                const file = await fileHandle.getFile();
                const content = await file.text();
                
                // 폴더 핸들 저장 (같은 폴더에 저장할 때 사용)
                // fileHandle의 부모 폴더를 가져오려면 resolve를 사용
                // 하지만 직접적으로는 안되므로, 저장 시 같은 파일명으로 저장되도록 핸들 저장
                this._openedFileHandle = fileHandle;
                
                this.loadFileContent(content, file.name);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.log('File System API 실패, fallback 사용');
                    document.getElementById('fileInput').click();
                }
            }
        } else {
            // Fallback: 기존 방식
            document.getElementById('fileInput').click();
        }
    }
    
    // 파일 내용 로드 (공통 함수)
    loadFileContent(content, filename) {
        try {
            const data = JSON.parse(content);
            this.objects = data.objects || [];
            
            // ID 중복 수정: 모든 오브젝트에 새 고유 ID 할당
            const idMap = new Map(); // 기존 ID -> 새 ID 매핑
            let newId = 1;
            this.objects.forEach(obj => {
                if (!idMap.has(obj.id)) {
                    idMap.set(obj.id, newId);
                }
                obj.id = idMap.get(obj.id) || newId++;
                // 같은 기존 ID를 가진 다른 오브젝트가 있으면 새 ID 부여
                if (idMap.get(obj.id) === obj.id) {
                    newId++;
                }
            });
            // 다시 한번 고유 ID 보장
            const usedIds = new Set();
            this.objects.forEach(obj => {
                while (usedIds.has(obj.id)) {
                    obj.id = newId++;
                }
                usedIds.add(obj.id);
            });
            this.nextId = newId;
            
            this.gridSize = data.gridSize || 32;
            document.getElementById('gridSizeSelect').value = this.gridSize;
            
            // 레벨 이름 로드 (JSON에서 또는 파일명에서)
            if (data.levelName) {
                this.levelName = data.levelName;
            } else {
                // 파일명에서 확장자 제거하여 레벨 이름으로 사용
                this.levelName = filename.replace(/\.[^/.]+$/, '') || 'Untitled';
            }
            this.updateLevelNameDisplay();
            
            this.clearSelection();
            this.saveState();
            this.updateProps();
            this.updateObjectsList();
            this.zoomFit();
            
            // 최근 파일에 추가
            this.addToRecentFiles(filename);
            
            this.showToast(`📂 ${this.levelName} 로드 완료`);
        } catch (err) {
            alert('파일을 불러올 수 없습니다.');
        }
    }
    
    loadFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            this.loadFileContent(ev.target.result, file.name);
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    exportImage() {
        // Calculate bounds
        let minX = 0, minY = 0, maxX = 1000, maxY = 1000;
        if (this.objects.length > 0) {
            minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
            this.objects.forEach(o => {
                let pts = [];
                
                if (o.points && o.points.length > 0) {
                    pts = o.points;
                } else if (o.x1 !== undefined && o.y1 !== undefined) {
                    pts = [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }];
                } else if (o.x !== undefined && o.y !== undefined) {
                    pts = [
                        { x: o.x - (o.radius || 0), y: o.y - (o.radius || 0) }, 
                        { x: o.x + (o.width || o.radius || 0), y: o.y + (o.height || o.radius || 0) }
                    ];
                }
                
                pts.forEach(p => {
                    if (p && !isNaN(p.x) && !isNaN(p.y)) {
                        minX = Math.min(minX, p.x);
                        minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x);
                        maxY = Math.max(maxY, p.y);
                    }
                });
            });
            
            if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
                minX -= 50; minY -= 50; maxX += 50; maxY += 50;
            } else {
                minX = 0; minY = 0; maxX = 1000; maxY = 1000;
            }
        }

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = maxX - minX;
        tempCanvas.height = maxY - minY;

        // Background
        tempCtx.fillStyle = '#0a0a0f';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Grid
        tempCtx.strokeStyle = 'rgba(255,255,255,0.04)';
        for (let x = 0; x < tempCanvas.width; x += this.gridSize) {
            tempCtx.beginPath();
            tempCtx.moveTo(x, 0);
            tempCtx.lineTo(x, tempCanvas.height);
            tempCtx.stroke();
        }
        for (let y = 0; y < tempCanvas.height; y += this.gridSize) {
            tempCtx.beginPath();
            tempCtx.moveTo(0, y);
            tempCtx.lineTo(tempCanvas.width, y);
            tempCtx.stroke();
        }

        // Objects
        tempCtx.translate(-minX, -minY);
        this.objects.forEach(o => this.drawObject(tempCtx, o));

        // Download
        const url = tempCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `level_${new Date().toISOString().slice(0,10)}.png`;
        a.click();
    }

    // ===== Blender 내보내기 =====
    showBlenderExportDialog() {
        // 기존 다이얼로그 제거
        const existing = document.getElementById('blenderExportDialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'blenderExportDialog';
        dialog.innerHTML = `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;">
                <div style="background:#1a1a2e;border-radius:12px;padding:24px;min-width:450px;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                    <h3 style="margin:0 0 16px 0;color:#ea7600;"><i class="fa-solid fa-cube"></i> 3D Export Settings</h3>
                    
                    <div style="margin-bottom:16px;">
                        <label style="display:block;margin-bottom:8px;font-weight:bold;">Wall Height (m)</label>
                        <input type="number" id="blenderWallHeight" value="3" min="1" max="20" step="0.5" 
                               style="width:100%;padding:8px;background:#0a0a0f;border:1px solid #333;border-radius:4px;color:#fff;">
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label style="display:block;margin-bottom:8px;font-weight:bold;">
                            <i class="fa-solid fa-folder"></i> FBX Output Path (Unity)
                        </label>
                        <div style="display:flex;gap:8px;">
                            <input type="text" id="fbxOutputPath" placeholder="Select folder or paste path..." 
                                   value="${this.fbxOutputPath || ''}"
                                   style="flex:1;padding:8px;background:#0a0a0f;border:1px solid #333;border-radius:4px;color:#fff;font-size:12px;">
                            <button id="browseFbxPath" style="padding:8px 12px;background:#3d3d5c;border:none;border-radius:4px;color:#fff;cursor:pointer;" title="Browse folder">
                                <i class="fa-solid fa-folder-open"></i>
                            </button>
                        </div>
                        <div style="font-size:10px;color:#888;margin-top:4px;">
                            Leave empty to skip Unity copy. FBX will be created in Level folder.
                        </div>
                    </div>
                    
                    <div style="margin-bottom:12px;">
                        <label style="display:block;margin-bottom:8px;font-weight:bold;">Export Format</label>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <button id="exportFBXAuto" style="padding:14px;background:#27ae60;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:bold;font-size:14px;">
                                <i class="fa-solid fa-bolt"></i> FBX Auto Generate (Unity) ⭐
                            </button>
                            <div style="display:flex;gap:8px;">
                                <button id="exportOBJ" style="flex:1;padding:10px;background:#2a5a8a;border:none;border-radius:6px;color:#fff;cursor:pointer;">
                                    <i class="fa-solid fa-file-export"></i> OBJ
                                </button>
                                <button id="exportPython" style="flex:1;padding:10px;background:#ea7600;border:none;border-radius:6px;color:#fff;cursor:pointer;">
                                    <i class="fa-brands fa-python"></i> Python
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="font-size:11px;color:#888;margin-bottom:16px;background:#0a0a0f;padding:10px;border-radius:6px;">
                        <p style="margin:0 0 4px 0;"><b>⭐ FBX Auto:</b> Blender converts JSON → FBX automatically</p>
                        <p style="margin:0 0 4px 0;"><b>OBJ:</b> Direct import to Unity/Blender</p>
                        <p style="margin:0;"><b>Python:</b> Run in Blender script editor</p>
                    </div>
                    
                    <button id="closeBlenderDialog" style="width:100%;padding:10px;background:#333;border:none;border-radius:6px;color:#fff;cursor:pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // 이벤트 바인딩
        const saveFbxPath = () => {
            const path = document.getElementById('fbxOutputPath').value.trim();
            this.fbxOutputPath = path;
            localStorage.setItem('levelforge_fbxOutputPath', path);
            this.saveConfig();
        };
        
        document.getElementById('fbxOutputPath').addEventListener('change', saveFbxPath);
        
        document.getElementById('browseFbxPath').addEventListener('click', async () => {
            if (window.showDirectoryPicker) {
                try {
                    const handle = await window.showDirectoryPicker({
                        id: 'fbx-output-folder',
                        mode: 'readwrite'
                    });
                    // Directory picker doesn't give us the path directly in browser
                    // Store handle for later use
                    this._fbxOutputHandle = handle;
                    document.getElementById('fbxOutputPath').value = handle.name + ' (selected)';
                    this.showToast('📁 Folder selected: ' + handle.name);
                } catch (e) {
                    if (e.name !== 'AbortError') console.log(e);
                }
            } else {
                this.showToast('⚠️ Paste the folder path directly', 3000);
            }
        });
        
        document.getElementById('exportFBXAuto').addEventListener('click', () => {
            saveFbxPath();
            const wallHeight = parseFloat(document.getElementById('blenderWallHeight').value) || 3;
            this.exportFBXWithBatch(wallHeight);
            dialog.remove();
        });
        
        document.getElementById('exportOBJ').addEventListener('click', () => {
            const wallHeight = parseFloat(document.getElementById('blenderWallHeight').value) || 3;
            this.exportToOBJ(wallHeight);
            dialog.remove();
        });
        
        document.getElementById('exportPython').addEventListener('click', () => {
            const wallHeight = parseFloat(document.getElementById('blenderWallHeight').value) || 3;
            this.exportToBlenderPython(wallHeight);
            dialog.remove();
        });
        
        document.getElementById('closeBlenderDialog').addEventListener('click', () => dialog.remove());
    }
    
    // Save config.txt for converter (simple text file with path)
    async saveConfig() {
        const path = this.fbxOutputPath || '';
        
        // Save to Level folder if we have folder handle
        if (this._levelFolderHandle) {
            try {
                const fileHandle = await this._levelFolderHandle.getFileHandle('config.txt', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(path);
                await writable.close();
                this.showToast('📁 Output path saved');
            } catch (e) {
                console.log('Config save failed:', e);
            }
        }
    }
    
    // FBX 자동 생성 (배치 파일 + Python 스크립트)
    async exportFBXWithBatch(wallHeight = 3) {
        // 파일명 생성 (레벨 이름 기반)
        const safeName = this.levelName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Untitled';
        const fileName = `${safeName}.json`;
        
        // JSON 데이터 생성
        const jsonData = JSON.stringify({
            version: '1.0',
            levelName: this.levelName,
            exportDate: new Date().toISOString(),
            gridSize: this.gridSize,
            pixelsPerMeter: this.pixelsPerMeter,
            wallHeight: wallHeight,
            objects: this.objects
        }, null, 2);
        
        // 저장된 파일/폴더 핸들 사용 또는 새로 선택
        if (window.showSaveFilePicker) {
            try {
                // 1순위: 열었던 파일 핸들이 있으면 같은 파일에 덮어쓰기
                if (this._openedFileHandle) {
                    try {
                        const writable = await this._openedFileHandle.createWritable();
                        await writable.write(jsonData);
                        await writable.close();
                        this.showToast(`✅ ${safeName} 저장 완료`);
                        return;
                    } catch (e) {
                        // 권한 만료 등의 이유로 실패하면 다시 선택
                        this._openedFileHandle = null;
                    }
                }
                
                // 2순위: 폴더 핸들이 저장되어 있으면 재사용
                if (this._levelFolderHandle) {
                    try {
                        const fileHandle = await this._levelFolderHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(jsonData);
                        await writable.close();
                        // 저장한 파일 핸들도 저장
                        this._openedFileHandle = fileHandle;
                        this.showToast(`✅ ${safeName} 저장 완료`);
                        return;
                    } catch (e) {
                        // 권한 만료 등의 이유로 실패하면 다시 선택
                        this._levelFolderHandle = null;
                    }
                }
                
                // 3순위: 폴더 선택 (최초 1회)
                if (window.showDirectoryPicker) {
                    try {
                        this._levelFolderHandle = await window.showDirectoryPicker({
                            id: 'levelforge-folder',
                            mode: 'readwrite',
                            startIn: 'documents'
                        });
                        
                        const fileHandle = await this._levelFolderHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(jsonData);
                        await writable.close();
                        // 저장한 파일 핸들도 저장
                        this._openedFileHandle = fileHandle;
                        this.showToast(`✅ ${safeName} 저장 완료 (폴더 설정됨)`);
                        return;
                    } catch (err) {
                        if (err.name === 'AbortError') return;
                    }
                }
                
                // Fallback: 파일 선택
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON 파일',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                
                const writable = await handle.createWritable();
                await writable.write(jsonData);
                await writable.close();
                // 저장한 파일 핸들도 저장
                this._openedFileHandle = handle;
                this.showToast(`✅ ${safeName} 저장 완료`);
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.log('File System API 실패, 다운로드 방식 사용');
            }
        }
        
        // Fallback: 일반 다운로드
        const jsonBlob = new Blob([jsonData], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = fileName;
        jsonLink.click();
        URL.revokeObjectURL(jsonUrl);
        this.showToast(`✅ ${safeName} 다운로드 완료`);
    }
    
    // 레벨 이름 변경 다이얼로그
    showRenameDialog() {
        const newName = prompt('레벨 이름을 입력하세요:', this.levelName);
        if (newName !== null && newName.trim()) {
            this.levelName = newName.trim();
            this.updateLevelNameDisplay();
        }
    }
    
    // 레벨 이름 UI 업데이트
    updateLevelNameDisplay() {
        const el = document.getElementById('levelNameDisplay');
        if (el) el.textContent = this.levelName;
    }
    
    // 토스트 알림 표시
    showToast(message, duration = 2000) {
        // 기존 토스트 제거
        const existing = document.getElementById('levelforge-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'levelforge-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #27ae60;
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 99999;
            animation: toastFadeIn 0.3s ease;
        `;
        
        // 애니메이션 스타일 추가
        if (!document.getElementById('toast-style')) {
            const style = document.createElement('style');
            style.id = 'toast-style';
            style.textContent = `
                @keyframes toastFadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes toastFadeOut {
                    from { opacity: 1; transform: translateX(-50%) translateY(0); }
                    to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // 자동 제거
        setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // Blender 스크립트 생성 (공통)
    generateBlenderScript(wallHeight, fbxFilename) {
        const SCALE = 1 / this.pixelsPerMeter;
        
        let script = `# LEVELFORGE - Auto FBX Generator
# Generated: ${new Date().toISOString()}
# 이 파일을 직접 실행하지 마세요. .bat 파일을 실행하세요!

import bpy
import bmesh
import os

# 기존 오브젝트 모두 삭제
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 새 컬렉션 생성
collection_name = "LevelForge"
if collection_name in bpy.data.collections:
    collection = bpy.data.collections[collection_name]
    for obj in collection.objects:
        bpy.data.objects.remove(obj)
else:
    collection = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(collection)

def create_floor(name, x, y, w, h, color, height=0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, y + h/2, height))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, h, 1)
    bpy.ops.object.transform_apply(scale=True)
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def create_wall_box(name, x, y, w, d, h, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x + w/2, y + d/2, h/2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def create_polyfloor(name, points, color, height=0):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bm = bmesh.new()
    verts = [bm.verts.new((p[0], p[1], height)) for p in points]
    if len(verts) >= 3:
        bm.faces.new(verts)
    bm.to_mesh(mesh)
    bm.free()
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    collection.objects.link(obj)
    return obj

def hex_to_rgba(color_str, alpha=1.0):
    import re
    # HSLA 포맷 처리: hsla(h, s%, l%, a) 또는 hsl(h, s%, l%)
    hsla_match = re.match(r'hsla?\\(\\s*(\\d+),\\s*(\\d+)%,\\s*(\\d+)%(?:,\\s*([\\d.]+))?\\)', color_str)
    if hsla_match:
        h = int(hsla_match.group(1)) / 360.0
        s = int(hsla_match.group(2)) / 100.0
        l = int(hsla_match.group(3)) / 100.0
        a = float(hsla_match.group(4)) if hsla_match.group(4) else alpha
        # HSL to RGB
        if s == 0:
            r = g = b = l
        else:
            def hue2rgb(p, q, t):
                if t < 0: t += 1
                if t > 1: t -= 1
                if t < 1/6: return p + (q - p) * 6 * t
                if t < 1/2: return q
                if t < 2/3: return p + (q - p) * (2/3 - t) * 6
                return p
            q = l * (1 + s) if l < 0.5 else l + s - l * s
            p = 2 * l - q
            r = hue2rgb(p, q, h + 1/3)
            g = hue2rgb(p, q, h)
            b = hue2rgb(p, q, h - 1/3)
        return (r, g, b, a)
    # HEX 포맷 처리
    hex_color = color_str.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = tuple(int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
        return (r, g, b, alpha)
    return (0.5, 0.5, 0.5, alpha)

# ===== 레벨 오브젝트 생성 =====
WALL_HEIGHT = ${wallHeight}

`;
        
        this.objects.forEach(obj => {
            const x = (obj.x || 0) * SCALE;
            const y = (obj.y || 0) * SCALE;
            const w = (obj.width || 0) * SCALE;
            const h = (obj.height || 0) * SCALE;
            const label = obj.label || obj.type;
            // HSLA를 HEX로 변환해서 전달
            const color = this.floorColorToHex(obj.color) || '#808080';
            
            if (obj.type === 'floor-area') {
                const fh = obj.floorHeight || 0;
                script += `create_floor("${label}_${obj.id}", ${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)}, hex_to_rgba("${color}"), ${fh})\n`;
            }
            else if (obj.type === 'wall') {
                script += `create_wall_box("${label}_${obj.id}", ${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)}, WALL_HEIGHT, hex_to_rgba("${color}"))\n`;
            }
            else if (obj.type === 'polyfloor' && obj.points) {
                const pts = obj.points.map(p => `(${(p.x * SCALE).toFixed(3)}, ${(p.y * SCALE).toFixed(3)})`).join(', ');
                script += `create_polyfloor("${label}_${obj.id}", [${pts}], hex_to_rgba("${color}"), ${obj.floorHeight || 0})\n`;
            }
        });
        
        script += `
# ===== FBX 내보내기 =====
print("\\n" + "="*50)
print("LEVELFORGE - FBX Generator")
print("="*50)

# 스크립트 위치에 FBX 저장
script_dir = os.path.dirname(os.path.abspath(__file__))
fbx_path = os.path.join(script_dir, "${fbxFilename}")

# 모든 오브젝트 선택
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)

# FBX 내보내기 (머티리얼 포함)
bpy.ops.export_scene.fbx(
    filepath=fbx_path,
    use_selection=True,
    apply_scale_options='FBX_SCALE_ALL',
    bake_space_transform=True,
    object_types={'MESH'},
    use_mesh_modifiers=True,
    path_mode='AUTO',
    embed_textures=False,
    mesh_smooth_type='FACE'
)

print(f"\\n[SUCCESS] FBX 생성 완료!")
print(f"파일: {fbx_path}")
print(f"오브젝트: {len(collection.objects)}개")
print("="*50 + "\\n")
`;
        
        return script;
    }

    // OBJ 파일로 내보내기
    exportToOBJ(wallHeight = 3) {
        const SCALE = 1 / this.pixelsPerMeter;  // px → meters
        let vertices = [];
        let faces = [];
        let vertexIndex = 1;
        
        // 그룹별로 정리
        let objContent = `# LEVELFORGE Export\n# Generated: ${new Date().toISOString()}\n\n`;
        
        this.objects.forEach(obj => {
            const startVertex = vertexIndex;
            objContent += `# Object: ${obj.label || obj.type} (ID: ${obj.id})\n`;
            objContent += `o ${obj.type}_${obj.id}\n`;
            
            if (obj.type === 'floor-area') {
                // 바닥 평면 (Y=0)
                const x = obj.x * SCALE;
                const z = obj.y * SCALE;
                const w = obj.width * SCALE;
                const h = obj.height * SCALE;
                const y = (obj.floorHeight || 0);
                
                objContent += `v ${x} ${y} ${z}\n`;
                objContent += `v ${x + w} ${y} ${z}\n`;
                objContent += `v ${x + w} ${y} ${z + h}\n`;
                objContent += `v ${x} ${y} ${z + h}\n`;
                objContent += `f ${startVertex} ${startVertex+1} ${startVertex+2} ${startVertex+3}\n\n`;
                vertexIndex += 4;
            }
            else if (obj.type === 'wall') {
                // 벽 박스
                const x = obj.x * SCALE;
                const z = obj.y * SCALE;
                const w = obj.width * SCALE;
                const d = obj.height * SCALE;
                const h = wallHeight;
                
                // 8 vertices (bottom 4, top 4)
                objContent += `v ${x} 0 ${z}\n`;
                objContent += `v ${x + w} 0 ${z}\n`;
                objContent += `v ${x + w} 0 ${z + d}\n`;
                objContent += `v ${x} 0 ${z + d}\n`;
                objContent += `v ${x} ${h} ${z}\n`;
                objContent += `v ${x + w} ${h} ${z}\n`;
                objContent += `v ${x + w} ${h} ${z + d}\n`;
                objContent += `v ${x} ${h} ${z + d}\n`;
                
                // 6 faces (quads)
                const v = startVertex;
                objContent += `f ${v} ${v+3} ${v+2} ${v+1}\n`;     // bottom
                objContent += `f ${v+4} ${v+5} ${v+6} ${v+7}\n`;   // top
                objContent += `f ${v} ${v+1} ${v+5} ${v+4}\n`;     // front
                objContent += `f ${v+2} ${v+3} ${v+7} ${v+6}\n`;   // back
                objContent += `f ${v} ${v+4} ${v+7} ${v+3}\n`;     // left
                objContent += `f ${v+1} ${v+2} ${v+6} ${v+5}\n\n`; // right
                vertexIndex += 8;
            }
            else if (obj.type === 'wall-diag') {
                // 대각선 벽
                const x1 = obj.x1 * SCALE;
                const z1 = obj.y1 * SCALE;
                const x2 = obj.x2 * SCALE;
                const z2 = obj.y2 * SCALE;
                const thick = (obj.thickness || 32) * SCALE / 2;
                const h = wallHeight;
                
                // 방향 벡터
                const dx = x2 - x1;
                const dz = z2 - z1;
                const len = Math.sqrt(dx*dx + dz*dz);
                const nx = -dz / len * thick;
                const nz = dx / len * thick;
                
                // 8 vertices
                objContent += `v ${x1 + nx} 0 ${z1 + nz}\n`;
                objContent += `v ${x1 - nx} 0 ${z1 - nz}\n`;
                objContent += `v ${x2 - nx} 0 ${z2 - nz}\n`;
                objContent += `v ${x2 + nx} 0 ${z2 + nz}\n`;
                objContent += `v ${x1 + nx} ${h} ${z1 + nz}\n`;
                objContent += `v ${x1 - nx} ${h} ${z1 - nz}\n`;
                objContent += `v ${x2 - nx} ${h} ${z2 - nz}\n`;
                objContent += `v ${x2 + nx} ${h} ${z2 + nz}\n`;
                
                const v = startVertex;
                objContent += `f ${v} ${v+3} ${v+2} ${v+1}\n`;
                objContent += `f ${v+4} ${v+5} ${v+6} ${v+7}\n`;
                objContent += `f ${v} ${v+1} ${v+5} ${v+4}\n`;
                objContent += `f ${v+2} ${v+3} ${v+7} ${v+6}\n`;
                objContent += `f ${v} ${v+4} ${v+7} ${v+3}\n`;
                objContent += `f ${v+1} ${v+2} ${v+6} ${v+5}\n\n`;
                vertexIndex += 8;
            }
            else if (obj.type === 'polywall' && obj.points && obj.points.length >= 3) {
                // 폴리곤 바닥/벽
                const pts = obj.points.map(p => ({ x: p.x * SCALE, z: p.y * SCALE }));
                const y = (obj.floorHeight || 0);
                
                pts.forEach(p => {
                    objContent += `v ${p.x} ${y} ${p.z}\n`;
                });
                
                objContent += 'f';
                for (let i = 0; i < pts.length; i++) {
                    objContent += ` ${startVertex + i}`;
                }
                objContent += '\n\n';
                vertexIndex += pts.length;
            }
            else if (obj.type === 'spawn-off' || obj.type === 'spawn-def' || obj.type === 'objective') {
                // 마커를 바닥 평면으로
                const x = obj.x * SCALE;
                const z = obj.y * SCALE;
                const w = obj.width * SCALE;
                const h = obj.height * SCALE;
                
                objContent += `v ${x} 0.01 ${z}\n`;
                objContent += `v ${x + w} 0.01 ${z}\n`;
                objContent += `v ${x + w} 0.01 ${z + h}\n`;
                objContent += `v ${x} 0.01 ${z + h}\n`;
                objContent += `f ${startVertex} ${startVertex+1} ${startVertex+2} ${startVertex+3}\n\n`;
                vertexIndex += 4;
            }
        });
        
        // 다운로드
        const blob = new Blob([objContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `level_${new Date().toISOString().slice(0,10)}.obj`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`✅ OBJ 파일 내보내기 완료 (${this.objects.length}개 오브젝트)`);
    }

    // Blender Python 스크립트로 내보내기
    exportToBlenderPython(wallHeight = 3) {
        const SCALE = 1 / this.pixelsPerMeter;
        
        let script = `# LEVELFORGE Blender Import Script
# Generated: ${new Date().toISOString()}
# Blender 스크립트 편집기에서 실행하세요

import bpy
import bmesh
from mathutils import Vector

# 기존 오브젝트 선택 해제
bpy.ops.object.select_all(action='DESELECT')

# 새 컬렉션 생성
collection_name = "LevelForge_Import"
if collection_name in bpy.data.collections:
    collection = bpy.data.collections[collection_name]
else:
    collection = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(collection)

def create_floor(name, x, y, w, h, color, height=0):
    """바닥 평면 생성"""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, y + h/2, height))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, h, 1)
    bpy.ops.object.transform_apply(scale=True)
    
    # 재질 적용 (노드 사용)
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    # 컬렉션 이동
    bpy.context.scene.collection.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def create_wall_box(name, x, y, w, d, h, color):
    """벽 박스 생성"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x + w/2, y + d/2, h/2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    bpy.context.scene.collection.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def create_diagonal_wall(name, x1, y1, x2, y2, thickness, height, color):
    """대각선 벽 생성"""
    dx, dy = x2 - x1, y2 - y1
    length = (dx**2 + dy**2)**0.5
    angle = __import__('math').atan2(dy, dx)
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, height/2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (length, thickness, height)
    obj.rotation_euler.z = angle
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    bpy.context.scene.collection.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def hex_to_rgba(color_str, alpha=1.0):
    """HEX 또는 HSLA 색상을 RGBA로 변환"""
    import re
    # HSLA 포맷 처리: hsla(h, s%, l%, a) 또는 hsl(h, s%, l%)
    hsla_match = re.match(r'hsla?\\(\\s*(\\d+),\\s*(\\d+)%,\\s*(\\d+)%(?:,\\s*([\\d.]+))?\\)', color_str)
    if hsla_match:
        h = int(hsla_match.group(1)) / 360.0
        s = int(hsla_match.group(2)) / 100.0
        l = int(hsla_match.group(3)) / 100.0
        a = float(hsla_match.group(4)) if hsla_match.group(4) else alpha
        # HSL to RGB
        if s == 0:
            r = g = b = l
        else:
            def hue2rgb(p, q, t):
                if t < 0: t += 1
                if t > 1: t -= 1
                if t < 1/6: return p + (q - p) * 6 * t
                if t < 1/2: return q
                if t < 2/3: return p + (q - p) * (2/3 - t) * 6
                return p
            q = l * (1 + s) if l < 0.5 else l + s - l * s
            p = 2 * l - q
            r = hue2rgb(p, q, h + 1/3)
            g = hue2rgb(p, q, h)
            b = hue2rgb(p, q, h - 1/3)
        return (r, g, b, a)
    # HEX 포맷 처리
    hex_color = color_str.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = tuple(int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
        return (r, g, b, alpha)
    return (0.5, 0.5, 0.5, alpha)

def create_polyfloor(name, points, color, height=0):
    """다각형 바닥 생성"""
    import bmesh
    
    # 새 메시 생성
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    
    # BMesh로 다각형 생성
    bm = bmesh.new()
    verts = [bm.verts.new((p[0], p[1], height)) for p in points]
    bm.faces.new(verts)
    bm.to_mesh(mesh)
    bm.free()
    
    # 재질 적용 (노드 사용해서 FBX에 색상 포함)
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    # 컬렉션에 추가
    collection.objects.link(obj)
    return obj

# ===== 레벨 오브젝트 생성 =====
WALL_HEIGHT = ${wallHeight}

`;
        
        this.objects.forEach(obj => {
            const x = (obj.x || 0) * SCALE;
            const y = (obj.y || 0) * SCALE;
            const w = (obj.width || 0) * SCALE;
            const h = (obj.height || 0) * SCALE;
            const name = `${obj.type}_${obj.id}`;
            // HSLA를 HEX로 변환
            const color = this.floorColorToHex(obj.color) || '#808080';
            const label = obj.label || obj.type;
            
            if (obj.type === 'floor-area') {
                const fh = obj.floorHeight || 0;
                script += `create_floor("${label}_${obj.id}", ${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)}, hex_to_rgba("${color}"), ${fh})\n`;
            }
            else if (obj.type === 'wall') {
                script += `create_wall_box("${label}_${obj.id}", ${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)}, WALL_HEIGHT, hex_to_rgba("${color}"))\n`;
            }
            else if (obj.type === 'wall-diag') {
                const x1 = obj.x1 * SCALE;
                const y1 = obj.y1 * SCALE;
                const x2 = obj.x2 * SCALE;
                const y2 = obj.y2 * SCALE;
                const thick = (obj.thickness || 32) * SCALE;
                script += `create_diagonal_wall("${label}_${obj.id}", ${x1.toFixed(3)}, ${y1.toFixed(3)}, ${x2.toFixed(3)}, ${y2.toFixed(3)}, ${thick.toFixed(3)}, WALL_HEIGHT, hex_to_rgba("${color}"))\n`;
            }
            else if (obj.type === 'spawn-off') {
                script += `create_floor("OffenceSpawn_${obj.id}", ${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)}, (0.9, 0.3, 0.2, 0.7), 0.01)\n`;
            }
            else if (obj.type === 'spawn-def') {
                script += `create_floor("DefenceSpawn_${obj.id}", ${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)}, (0.2, 0.7, 0.4, 0.7), 0.01)\n`;
            }
            else if (obj.type === 'objective') {
                script += `create_floor("Objective_${obj.id}", ${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)}, (0.95, 0.6, 0.1, 0.7), 0.02)\n`;
            }
            else if (obj.type === 'polyfloor' && obj.points) {
                // 다각형 바닥
                const pts = obj.points.map(p => `(${(p.x * SCALE).toFixed(3)}, ${(p.y * SCALE).toFixed(3)})`).join(', ');
                script += `create_polyfloor("${label}_${obj.id}", [${pts}], hex_to_rgba("${color}"), ${obj.floorHeight || 0})\n`;
            }
        });
        
        script += `
# 뷰포트 업데이트
bpy.context.view_layer.update()
print(f"✅ LevelForge Import 완료: {len(collection.objects)}개 오브젝트 생성됨")

# ===== FBX 자동 내보내기 =====
import os

# 스크립트 파일 위치에 FBX 저장
fbx_path = os.path.join(os.path.dirname(bpy.data.filepath) if bpy.data.filepath else "C:/Level", "level_export.fbx")

# 컬렉션 내 오브젝트만 선택
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)

# FBX 내보내기
bpy.ops.export_scene.fbx(
    filepath=fbx_path,
    use_selection=True,
    apply_scale_options='FBX_SCALE_ALL',
    bake_space_transform=True,
    object_types={'MESH'},
    use_mesh_modifiers=True,
    path_mode='COPY',
    embed_textures=False
)

print(f"✅ FBX 내보내기 완료: {fbx_path}")
print("→ Unity에서 Assets 폴더에 드래그하세요!")
`;
        
        // 다운로드
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `level_${new Date().toISOString().slice(0,10)}.py`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`✅ Blender Python 스크립트 내보내기 완료 (${this.objects.length}개 오브젝트)`);
    }

    // ===== 참조 이미지 기능 =====
    
    // 클립보드 붙여넣기 처리 (Ctrl+V)
    handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    this.loadImageFromFile(file);
                }
                return;
            }
        }
    }

    // 파일에서 이미지 로드 (공통)
    loadImageFromFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.refImage = img;
                this.refImageScale = 1;
                this.refImageOffset = { x: 0, y: 0 };
                this.showRefImageControls();
                this.render();
                console.log(`✅ 참조 이미지 로드됨: ${img.width}x${img.height}px`);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    loadReferenceImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.loadImageFromFile(file);
        e.target.value = '';
    }

    showRefImageControls() {
        // 기존 컨트롤 제거
        const existing = document.getElementById('refImageControls');
        if (existing) existing.remove();

        // 이미지 크기 (미터 단위) 계산
        const imgWidthM = this.refImage ? Math.round(this.refImage.width * this.refImageScale / this.gridSize) : 100;

        const controls = document.createElement('div');
        controls.id = 'refImageControls';
        controls.innerHTML = `
            <div style="position:fixed;top:60px;right:20px;background:#1a1a2e;padding:16px;border-radius:8px;z-index:1000;color:#fff;font-size:12px;box-shadow:0 4px 16px rgba(0,0,0,0.4);min-width:220px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                    <b>📷 참조 이미지</b>
                    <button id="closeRefControls" style="background:none;border:none;color:#fff;cursor:pointer;font-size:14px;">✕</button>
                </div>
                
                <div style="margin-bottom:12px;padding:8px;background:#0a0a0f;border-radius:4px;">
                    <label style="display:block;margin-bottom:4px;font-weight:bold;">맵 가로 크기 (m)</label>
                    <div style="display:flex;gap:4px;align-items:center;">
                        <input type="number" id="refMapWidth" value="${imgWidthM}" min="10" max="500" step="5" 
                               style="flex:1;padding:6px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;text-align:center;">
                        <button id="applyMapSize" style="padding:6px 12px;background:#27ae60;border:none;border-radius:4px;color:#fff;cursor:pointer;">적용</button>
                    </div>
                    <div style="font-size:10px;color:#888;margin-top:4px;">예: Valorant 맵 ≈ 80~120m</div>
                </div>
                
                <div style="margin-bottom:8px;">
                    <label>투명도: <span id="opacityVal">${Math.round(this.refImageOpacity * 100)}%</span></label>
                    <input type="range" id="refOpacity" min="0" max="100" value="${this.refImageOpacity * 100}" style="width:100%;">
                </div>
                
                <div style="margin-bottom:8px;">
                    <label>크기: <span id="scaleVal">${Math.round(this.refImageScale * 100)}%</span></label>
                    <input type="range" id="refScale" min="10" max="500" value="${this.refImageScale * 100}" style="width:100%;">
                </div>
                
                <div style="margin-bottom:12px;padding:8px;background:#2a5a8a33;border-radius:4px;text-align:center;">
                    <label style="cursor:pointer;">
                        <input type="checkbox" id="refDragMode" ${this.refDragMode ? 'checked' : ''}> 
                        <b>🖱️ 드래그 모드</b> (이미지 이동)
                    </label>
                </div>
                
                <div style="display:flex;gap:4px;">
                    <button id="refCenterBtn" style="flex:1;padding:6px;background:#2a5a8a;border:none;border-radius:4px;color:#fff;cursor:pointer;">중앙</button>
                    <button id="refFitBtn" style="flex:1;padding:6px;background:#6c5ce7;border:none;border-radius:4px;color:#fff;cursor:pointer;">맞추기</button>
                    <button id="refRemoveBtn" style="flex:1;padding:6px;background:#d63031;border:none;border-radius:4px;color:#fff;cursor:pointer;">제거</button>
                </div>
            </div>
        `;
        document.body.appendChild(controls);

        // 맵 크기 적용
        document.getElementById('applyMapSize').addEventListener('click', () => {
            if (this.refImage) {
                const targetWidthM = parseFloat(document.getElementById('refMapWidth').value) || 100;
                const targetWidthPx = targetWidthM * this.gridSize;
                this.refImageScale = targetWidthPx / this.refImage.width;
                document.getElementById('refScale').value = this.refImageScale * 100;
                document.getElementById('scaleVal').textContent = `${Math.round(this.refImageScale * 100)}%`;
                this.render();
            }
        });

        // 투명도
        document.getElementById('refOpacity').addEventListener('input', (e) => {
            this.refImageOpacity = e.target.value / 100;
            document.getElementById('opacityVal').textContent = `${e.target.value}%`;
            this.render();
        });

        // 스케일
        document.getElementById('refScale').addEventListener('input', (e) => {
            this.refImageScale = e.target.value / 100;
            document.getElementById('scaleVal').textContent = `${e.target.value}%`;
            // 맵 크기 업데이트
            if (this.refImage) {
                const widthM = Math.round(this.refImage.width * this.refImageScale / this.gridSize);
                document.getElementById('refMapWidth').value = widthM;
            }
            this.render();
        });

        // 드래그 모드
        document.getElementById('refDragMode').addEventListener('change', (e) => {
            this.refDragMode = e.target.checked;
            this.mainCanvas.style.cursor = this.refDragMode ? 'grab' : 'default';
        });

        // 중앙 배치
        document.getElementById('refCenterBtn').addEventListener('click', () => {
            if (this.refImage) {
                const imgW = this.refImage.width * this.refImageScale;
                const imgH = this.refImage.height * this.refImageScale;
                this.refImageOffset = {
                    x: (this.width / this.camera.zoom - imgW) / 2 - this.camera.x / this.camera.zoom,
                    y: (this.height / this.camera.zoom - imgH) / 2 - this.camera.y / this.camera.zoom
                };
                this.render();
            }
        });

        // 화면에 맞추기
        document.getElementById('refFitBtn').addEventListener('click', () => {
            if (this.refImage) {
                const fitScale = Math.min(this.width / this.refImage.width, this.height / this.refImage.height) * 0.9;
                this.refImageScale = fitScale;
                document.getElementById('refScale').value = fitScale * 100;
                document.getElementById('scaleVal').textContent = `${Math.round(fitScale * 100)}%`;
                // 맵 크기 업데이트
                const widthM = Math.round(this.refImage.width * fitScale / this.gridSize);
                document.getElementById('refMapWidth').value = widthM;
                // 중앙 배치
                const imgW = this.refImage.width * fitScale;
                const imgH = this.refImage.height * fitScale;
                this.refImageOffset = {
                    x: (this.width / this.camera.zoom - imgW) / 2 - this.camera.x / this.camera.zoom,
                    y: (this.height / this.camera.zoom - imgH) / 2 - this.camera.y / this.camera.zoom
                };
                this.render();
            }
        });

        // 제거
        document.getElementById('refRemoveBtn').addEventListener('click', () => {
            this.refImage = null;
            this.refDragMode = false;
            this.mainCanvas.style.cursor = 'default';
            controls.remove();
            this.render();
        });

        // 닫기
        document.getElementById('closeRefControls').addEventListener('click', () => {
            controls.remove();
        });
    }

    renderRefImage() {
        if (!this.refImage) return;
        
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = this.refImageOpacity;
        
        const w = this.refImage.width * this.refImageScale * this.camera.zoom;
        const h = this.refImage.height * this.refImageScale * this.camera.zoom;
        const x = this.refImageOffset.x * this.camera.zoom + this.camera.x;
        const y = this.refImageOffset.y * this.camera.zoom + this.camera.y;
        
        ctx.drawImage(this.refImage, x, y, w, h);
        ctx.restore();
    }

    // ===== 라인 추출 다이얼로그 =====
    showExtractLinesDialog() {
        if (!this.refImage) {
            alert('먼저 참조 이미지를 불러오세요!');
            return;
        }

        const existing = document.getElementById('extractLinesDialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'extractLinesDialog';
        dialog.innerHTML = `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;">
                <div style="background:#1a1a2e;border-radius:12px;padding:24px;min-width:400px;max-width:90%;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                    <h3 style="margin:0 0 16px 0;color:#f39c12;"><i class="fa-solid fa-wand-magic-sparkles"></i> 이미지 라인 추출</h3>
                    
                    <div style="margin-bottom:16px;">
                        <label style="display:block;margin-bottom:8px;">감지할 색상</label>
                        <div style="display:flex;gap:8px;">
                            <button class="line-color-btn" data-color="white" style="flex:1;padding:8px;background:#fff;color:#000;border:2px solid #4ecdc4;border-radius:4px;cursor:pointer;">흰색/밝은색</button>
                            <button class="line-color-btn" data-color="dark" style="flex:1;padding:8px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;">검은색/어두운색</button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label>밝기 임계값: <span id="threshVal">200</span></label>
                        <input type="range" id="lineThreshold" min="50" max="250" value="200" style="width:100%;">
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label>최소 라인 길이 (px): <span id="minLenVal">20</span></label>
                        <input type="range" id="minLineLen" min="5" max="100" value="20" style="width:100%;">
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label>벽 두께 (m):</label>
                        <input type="number" id="wallThickness" value="1" min="0.5" max="3" step="0.5" style="width:100%;padding:8px;background:#0a0a0f;border:1px solid #333;border-radius:4px;color:#fff;">
                    </div>
                    
                    <div style="display:flex;gap:8px;margin-top:20px;">
                        <button id="previewExtract" style="flex:1;padding:12px;background:#2a5a8a;border:none;border-radius:6px;color:#fff;cursor:pointer;">미리보기</button>
                        <button id="confirmExtract" style="flex:1;padding:12px;background:#27ae60;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:bold;">추출</button>
                        <button id="cancelExtract" style="flex:1;padding:12px;background:#555;border:none;border-radius:6px;color:#fff;cursor:pointer;">취소</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        let selectedColor = 'white';

        // 색상 버튼 이벤트
        dialog.querySelectorAll('.line-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dialog.querySelectorAll('.line-color-btn').forEach(b => b.style.border = '1px solid #555');
                btn.style.border = '2px solid #4ecdc4';
                selectedColor = btn.dataset.color;
            });
        });

        document.getElementById('lineThreshold').addEventListener('input', (e) => {
            document.getElementById('threshVal').textContent = e.target.value;
        });

        document.getElementById('minLineLen').addEventListener('input', (e) => {
            document.getElementById('minLenVal').textContent = e.target.value;
        });

        document.getElementById('previewExtract').addEventListener('click', () => {
            const threshold = parseInt(document.getElementById('lineThreshold').value);
            const minLen = parseInt(document.getElementById('minLineLen').value);
            this.previewExtractedLines(threshold, minLen, selectedColor);
        });

        document.getElementById('confirmExtract').addEventListener('click', () => {
            const threshold = parseInt(document.getElementById('lineThreshold').value);
            const minLen = parseInt(document.getElementById('minLineLen').value);
            const wallThick = parseFloat(document.getElementById('wallThickness').value) * this.gridSize;
            this.extractLinesFromImage(threshold, minLen, selectedColor, wallThick);
            dialog.remove();
        });

        document.getElementById('cancelExtract').addEventListener('click', () => {
            dialog.remove();
            this.render();
        });
    }

    // 라인 미리보기
    previewExtractedLines(threshold, minLen, colorMode) {
        const edges = this.detectEdges(threshold, colorMode);
        
        // UI 캔버스에 미리보기 그리기
        const ctx = this.uiCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        
        edges.forEach(edge => {
            if (edge.length >= minLen) {
                const x1 = edge.x1 * this.refImageScale * this.camera.zoom + this.camera.x;
                const y1 = edge.y1 * this.refImageScale * this.camera.zoom + this.camera.y;
                const x2 = edge.x2 * this.refImageScale * this.camera.zoom + this.camera.x;
                const y2 = edge.y2 * this.refImageScale * this.camera.zoom + this.camera.y;
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });
        
        console.log(`미리보기: ${edges.filter(e => e.length >= minLen).length}개 라인 감지됨`);
    }

    // 엣지 감지 (간단한 Sobel-like)
    detectEdges(threshold, colorMode) {
        if (!this.refImage) return [];

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.refImage.width;
        canvas.height = this.refImage.height;
        ctx.drawImage(this.refImage, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const edges = [];
        
        // 수평 및 수직 엣지 감지
        const checkBright = colorMode === 'white';
        
        for (let y = 1; y < canvas.height - 1; y += 2) {
            let lineStart = null;
            
            for (let x = 1; x < canvas.width - 1; x++) {
                const idx = (y * canvas.width + x) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                const isLine = checkBright ? brightness > threshold : brightness < (255 - threshold);
                
                if (isLine && !lineStart) {
                    lineStart = x;
                } else if (!isLine && lineStart) {
                    if (x - lineStart > 3) {
                        edges.push({
                            x1: lineStart, y1: y,
                            x2: x, y2: y,
                            length: x - lineStart,
                            type: 'horizontal'
                        });
                    }
                    lineStart = null;
                }
            }
        }
        
        // 수직 라인
        for (let x = 1; x < canvas.width - 1; x += 2) {
            let lineStart = null;
            
            for (let y = 1; y < canvas.height - 1; y++) {
                const idx = (y * canvas.width + x) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                const isLine = checkBright ? brightness > threshold : brightness < (255 - threshold);
                
                if (isLine && !lineStart) {
                    lineStart = y;
                } else if (!isLine && lineStart) {
                    if (y - lineStart > 3) {
                        edges.push({
                            x1: x, y1: lineStart,
                            x2: x, y2: y,
                            length: y - lineStart,
                            type: 'vertical'
                        });
                    }
                    lineStart = null;
                }
            }
        }
        
        return edges;
    }

    // 라인을 벽으로 변환
    extractLinesFromImage(threshold, minLen, colorMode, wallThick) {
        const edges = this.detectEdges(threshold, colorMode);
        const scale = this.refImageScale;
        let created = 0;
        
        edges.forEach(edge => {
            if (edge.length < minLen) return;
            
            const x1 = Math.round((edge.x1 * scale + this.refImageOffset.x) / this.gridSize) * this.gridSize;
            const y1 = Math.round((edge.y1 * scale + this.refImageOffset.y) / this.gridSize) * this.gridSize;
            const x2 = Math.round((edge.x2 * scale + this.refImageOffset.x) / this.gridSize) * this.gridSize;
            const y2 = Math.round((edge.y2 * scale + this.refImageOffset.y) / this.gridSize) * this.gridSize;
            
            if (edge.type === 'horizontal') {
                // 수평 벽
                const w = Math.abs(x2 - x1);
                if (w > this.gridSize) {
                    this.objects.push({
                        id: this.nextId++,
                        type: 'wall',
                        category: 'walls',
                        color: this.typeColors['wall'],
                        x: Math.min(x1, x2),
                        y: y1 - wallThick / 2,
                        width: w,
                        height: wallThick,
                        floor: this.currentFloor
                    });
                    created++;
                }
            } else {
                // 수직 벽
                const h = Math.abs(y2 - y1);
                if (h > this.gridSize) {
                    this.objects.push({
                        id: this.nextId++,
                        type: 'wall',
                        category: 'walls',
                        color: this.typeColors['wall'],
                        x: x1 - wallThick / 2,
                        y: Math.min(y1, y2),
                        width: wallThick,
                        height: h,
                        floor: this.currentFloor
                    });
                    created++;
                }
            }
        });
        
        this.saveState();
        this.updateObjectsList();
        this.render();
        
        console.log(`✅ 라인 추출 완료: ${created}개 벽 생성됨`);
        alert(`${created}개의 벽이 생성되었습니다!`);
    }

    // ===== 스케치 기능 =====
    
    renderSketch(ctx) {
        // 저장된 획 그리기
        this.sketchStrokes.forEach(stroke => {
            this.drawStroke(ctx, stroke);
        });
        
        // 현재 그리는 획
        if (this.currentStroke && this.currentStroke.points.length > 0) {
            this.drawStroke(ctx, this.currentStroke);
        }
    }
    
    drawStroke(ctx, stroke) {
        if (stroke.points.length < 2) return;
        
        ctx.strokeStyle = stroke.color || '#e84393';
        ctx.lineWidth = stroke.size || 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    }
    
    eraseAtPoint(x, y) {
        const eraseRadius = this.sketchBrushSize * 3;
        
        // 지우개 범위 내의 획 삭제
        this.sketchStrokes = this.sketchStrokes.filter(stroke => {
            // 획의 모든 포인트 체크
            const hasNearPoint = stroke.points.some(p => {
                const dx = p.x - x;
                const dy = p.y - y;
                return Math.sqrt(dx * dx + dy * dy) < eraseRadius;
            });
            return !hasNearPoint;
        });
        
        this.render();
    }
    
    clearSketch() {
        if (this.sketchStrokes.length === 0) {
            alert('지울 스케치가 없습니다.');
            return;
        }
        
        if (confirm('모든 스케치를 지우시겠습니까?')) {
            this.sketchStrokes = [];
            this.render();
        }
    }
    
    convertSketchToWalls() {
        if (this.sketchStrokes.length === 0) {
            alert('변환할 스케치가 없습니다.\n브러시(B)로 먼저 그려주세요!');
            return;
        }
        
        const wallThickness = this.gridSize;  // 1m 두께
        let created = 0;
        
        this.sketchStrokes.forEach(stroke => {
            if (stroke.points.length < 2) return;
            
            // 획을 단순화 (Douglas-Peucker 알고리즘)
            const simplified = this.simplifyPath(stroke.points, this.gridSize);
            
            // 연속된 점들을 벽 세그먼트로 변환
            for (let i = 0; i < simplified.length - 1; i++) {
                const p1 = simplified[i];
                const p2 = simplified[i + 1];
                
                // 스냅된 좌표
                const x1 = Math.round(p1.x / this.gridSize) * this.gridSize;
                const y1 = Math.round(p1.y / this.gridSize) * this.gridSize;
                const x2 = Math.round(p2.x / this.gridSize) * this.gridSize;
                const y2 = Math.round(p2.y / this.gridSize) * this.gridSize;
                
                // 최소 거리 체크
                const dx = Math.abs(x2 - x1);
                const dy = Math.abs(y2 - y1);
                if (dx < this.gridSize && dy < this.gridSize) continue;
                
                // 수평/수직인지 대각선인지 판단
                if (dx > dy * 2) {
                    // 수평 벽
                    this.objects.push({
                        id: this.nextId++,
                        type: 'wall',
                        category: 'walls',
                        color: this.typeColors['wall'],
                        x: Math.min(x1, x2),
                        y: Math.min(y1, y2) - wallThickness / 2,
                        width: Math.abs(x2 - x1),
                        height: wallThickness,
                        floor: this.currentFloor
                    });
                    created++;
                } else if (dy > dx * 2) {
                    // 수직 벽
                    this.objects.push({
                        id: this.nextId++,
                        type: 'wall',
                        category: 'walls',
                        color: this.typeColors['wall'],
                        x: Math.min(x1, x2) - wallThickness / 2,
                        y: Math.min(y1, y2),
                        width: wallThickness,
                        height: Math.abs(y2 - y1),
                        floor: this.currentFloor
                    });
                    created++;
                } else {
                    // 대각선 벽
                    this.objects.push({
                        id: this.nextId++,
                        type: 'wall-diag',
                        category: 'walls',
                        color: this.typeColors['wall-diag'],
                        x1: x1, y1: y1,
                        x2: x2, y2: y2,
                        thickness: wallThickness,
                        floor: this.currentFloor
                    });
                    created++;
                }
            }
        });
        
        if (created > 0) {
            // 스케치 지우기
            this.sketchStrokes = [];
            this.saveState();
            this.updateObjectsList();
            this.render();
            
            console.log(`✅ 스케치 변환 완료: ${created}개 벽 생성됨`);
            alert(`${created}개의 벽이 생성되었습니다!`);
        } else {
            alert('변환할 수 있는 유효한 라인이 없습니다.\n더 길게 그려주세요.');
        }
    }
    
    // Douglas-Peucker 경로 단순화
    simplifyPath(points, tolerance) {
        if (points.length <= 2) return points;
        
        // 최대 거리 포인트 찾기
        let maxDist = 0;
        let maxIdx = 0;
        
        const first = points[0];
        const last = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                maxIdx = i;
            }
        }
        
        // 임계값보다 크면 분할
        if (maxDist > tolerance) {
            const left = this.simplifyPath(points.slice(0, maxIdx + 1), tolerance);
            const right = this.simplifyPath(points.slice(maxIdx), tolerance);
            return left.slice(0, -1).concat(right);
        }
        
        return [first, last];
    }
    
    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len === 0) return Math.sqrt(
            Math.pow(point.x - lineStart.x, 2) + 
            Math.pow(point.y - lineStart.y, 2)
        );
        
        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len);
        const nearX = lineStart.x + t * dx;
        const nearY = lineStart.y + t * dy;
        
        return Math.sqrt(
            Math.pow(point.x - nearX, 2) + 
            Math.pow(point.y - nearY, 2)
        );
    }
    
    // ========== SIMULATION ==========
    startSimulation() {
        const defSpawn = this.objects.find(o => o.type === 'spawn-def');
        const offSpawn = this.objects.find(o => o.type === 'spawn-off');
        const objective = this.objects.find(o => o.type === 'objective');
        
        if (!defSpawn || !offSpawn || !objective) {
            alert('시뮬레이션을 위해 Defence Spawn, Offence Spawn, Objective가 필요합니다.');
            return;
        }
        
        // UI 업데이트
        document.getElementById('simStartBtn').style.display = 'none';
        document.getElementById('simStopBtn').style.display = 'block';
        document.getElementById('simPinBtn').style.display = 'block';
        document.getElementById('simStatus').textContent = '경로 계산 중...';
        
        // 스코어 초기화
        this.simScore = { defence: 0, offence: 0 };
        
        // 네비게이션 그리드 생성
        this.navGrid = this.buildNavGrid();
        if (!this.navGrid) {
            alert('Floor가 없어서 경로를 계산할 수 없습니다.');
            return;
        }
        
        // 에이전트 생성
        this.simAgents = [];
        
        const objCX = objective.x + objective.width / 2;
        const objCY = objective.y + objective.height / 2;
        
        // 미리보기 경로 가져오기
        const defPaths = this.previewPaths.filter(p => p.team === 'defence');
        const offPaths = this.previewPaths.filter(p => p.team === 'offence');
        
        // 웨이포인트 수집 (경로 다양화용)
        this.floorWaypoints = [];
        for (const obj of this.objects) {
            if (obj.floor !== this.currentFloor) continue;
            if (obj.type === 'polyfloor' && obj.points && obj.points.length > 2) {
                let cx = 0, cy = 0;
                for (const p of obj.points) { cx += p.x; cy += p.y; }
                cx /= obj.points.length;
                cy /= obj.points.length;
                this.floorWaypoints.push({ id: obj.id, x: cx, y: cy, label: obj.label });
            }
        }
        
        const defColors = ['#27ae60', '#2ecc71', '#58d68d', '#82e0aa', '#1d8348'];
        const offColors = ['#e74c3c', '#ec7063', '#c0392b', '#f1948a', '#a93226'];
        
        // Defence 팀 (5명) - 웨이포인트 경유 경로 분산 배치
        const defCX = defSpawn.x + defSpawn.width / 2;
        const defCY = defSpawn.y + defSpawn.height / 2;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const dist = 50 + Math.random() * 30;
            const startX = defCX + Math.cos(angle) * dist;
            const startY = defCY + Math.sin(angle) * dist;
            
            // 각 에이전트마다 다른 웨이포인트 경유 경로 생성
            let agentPath;
            if (defPaths.length > 0) {
                const routeIdx = i % defPaths.length;
                agentPath = [...defPaths[routeIdx].path];
            } else if (this.floorWaypoints.length > 0 && i < this.floorWaypoints.length) {
                // 웨이포인트 경유 경로 (각 에이전트마다 다른 웨이포인트)
                const wp = this.floorWaypoints[i % this.floorWaypoints.length];
                const path1 = this.findPath(startX, startY, wp.x, wp.y, this.navGrid, Math.random() * 3);
                const path2 = this.findPath(wp.x, wp.y, objCX, objCY, this.navGrid, Math.random() * 3);
                agentPath = (path1 && path2) ? [...path1, ...path2.slice(1)] : 
                            this.findPath(startX, startY, objCX, objCY, this.navGrid, i * 2);
            } else {
                const randomFactor = i * 3;
                agentPath = this.findPath(startX, startY, objCX, objCY, this.navGrid, randomFactor);
            }
            
            this.simAgents.push({
                id: i,
                team: 'defence',
                x: startX,
                y: startY,
                path: agentPath,
                pathIndex: 0,
                hp: 5,
                angle: Math.random() * Math.PI * 2,
                state: 'moving',
                lastShot: 0,
                color: defColors[i % defColors.length]
            });
        }
        
        // Offence 팀 (5명) - 웨이포인트 경유 경로 분산 배치
        const offCX = offSpawn.x + offSpawn.width / 2;
        const offCY = offSpawn.y + offSpawn.height / 2;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const dist = 50 + Math.random() * 30;
            const startX = offCX + Math.cos(angle) * dist;
            const startY = offCY + Math.sin(angle) * dist;
            
            // 각 에이전트마다 다른 웨이포인트 경유 경로 생성
            let agentPath;
            if (offPaths.length > 0) {
                const routeIdx = i % offPaths.length;
                agentPath = [...offPaths[routeIdx].path];
            } else if (this.floorWaypoints.length > 0 && i < this.floorWaypoints.length) {
                // 웨이포인트 경유 경로 (Offence는 역순으로 다른 웨이포인트)
                const wpIdx = (this.floorWaypoints.length - 1 - i) % this.floorWaypoints.length;
                const wp = this.floorWaypoints[wpIdx >= 0 ? wpIdx : 0];
                const path1 = this.findPath(startX, startY, wp.x, wp.y, this.navGrid, Math.random() * 3);
                const path2 = this.findPath(wp.x, wp.y, objCX, objCY, this.navGrid, Math.random() * 3);
                agentPath = (path1 && path2) ? [...path1, ...path2.slice(1)] :
                            this.findPath(startX, startY, objCX, objCY, this.navGrid, i * 2);
            } else {
                const randomFactor = i * 3;
                agentPath = this.findPath(startX, startY, objCX, objCY, this.navGrid, randomFactor);
            }
            
            this.simAgents.push({
                id: i + 5,
                team: 'offence',
                x: startX,
                y: startY,
                path: agentPath,
                pathIndex: 0,
                hp: 5,
                angle: Math.random() * Math.PI * 2,
                state: 'moving',
                lastShot: 0,
                color: offColors[i % offColors.length]
            });
        }
        
        // 미리보기 끄기
        this.showPreview = false;
        
        document.getElementById('simStatus').textContent = '시뮬레이션 진행 중...';
        
        this.simRunning = true;
        this.simLastTime = performance.now();
        this.simLoop();
    }
    
    stopSimulation() {
        this.simRunning = false;
        this.simAgents = [];
        this.simScore = { defence: 0, offence: 0 };
        this.pinMode = false;
        this.pinLocation = null;
        
        // UI 업데이트
        document.getElementById('simStartBtn').style.display = 'block';
        document.getElementById('simStopBtn').style.display = 'none';
        document.getElementById('simPinBtn').style.display = 'none';
        document.getElementById('simPinBtn').classList.remove('active');
        document.getElementById('simStatus').textContent = 'Defence/Offence 배치 후 시작';
        
        this.render();
    }
    
    // 핀 모드 토글
    togglePinMode() {
        this.pinMode = !this.pinMode;
        const btn = document.getElementById('simPinBtn');
        if (this.pinMode) {
            btn.classList.add('active');
            btn.style.background = '#8a6a2d';
            document.getElementById('simStatus').textContent = '📍 캔버스를 클릭하여 핀을 꽂으세요';
        } else {
            btn.classList.remove('active');
            btn.style.background = '#5a4a2d';
            document.getElementById('simStatus').innerHTML = 
                `<span style="color:#27ae60">DEF: ${this.simScore.defence}</span> | <span style="color:#e74c3c">OFF: ${this.simScore.offence}</span>`;
        }
    }
    
    // 핀 꽂기 - 모든 에이전트를 해당 위치로 이동시킴
    placePin(x, y) {
        if (!this.simRunning || !this.navGrid) return;
        
        // floor 위인지 체크
        if (!this.isOnFloor(x, y)) {
            this.showToast('Floor 위에만 핀을 꽂을 수 있습니다', 2000);
            return;
        }
        
        this.pinLocation = { x, y };
        
        // 모든 에이전트의 경로를 핀 위치로 재설정
        for (const agent of this.simAgents) {
            if (agent.state === 'dead') continue;
            
            const randomFactor = Math.random() * 4;  // 약간의 경로 다양성
            const path = this.findPath(agent.x, agent.y, x, y, this.navGrid, randomFactor);
            
            if (path && path.length > 1) {
                agent.path = path;
                agent.pathIndex = 0;
            }
        }
        
        this.showToast(`📍 핀 설정! 모든 에이전트가 이동합니다`, 2000);
        document.getElementById('simStatus').innerHTML = 
            `📍 핀 위치로 이동 중... | <span style="color:#27ae60">DEF: ${this.simScore.defence}</span> | <span style="color:#e74c3c">OFF: ${this.simScore.offence}</span>`;
    }
    
    // 경로 미리보기 - 여러 다른 경로 탐색
    previewRoutes() {
        const defSpawn = this.objects.find(o => o.type === 'spawn-def');
        const offSpawn = this.objects.find(o => o.type === 'spawn-off');
        const objective = this.objects.find(o => o.type === 'objective');
        
        if (!defSpawn || !offSpawn || !objective) {
            alert('경로 미리보기를 위해 Defence Spawn, Offence Spawn, Objective가 필요합니다.');
            return;
        }
        
        // 네비게이션 그리드 생성
        this.navGrid = this.buildNavGrid();
        if (!this.navGrid) {
            alert('Floor가 없어서 경로를 계산할 수 없습니다.');
            return;
        }
        
        document.getElementById('simStatus').textContent = '경로 탐색 중...';
        
        // 모든 polyfloor의 중심점을 waypoint로 수집
        this.floorWaypoints = [];
        for (const obj of this.objects) {
            if (obj.floor !== this.currentFloor) continue;
            if (obj.type === 'polyfloor' && obj.points && obj.points.length > 2) {
                // 폴리곤 중심점 계산
                let cx = 0, cy = 0;
                for (const p of obj.points) {
                    cx += p.x;
                    cy += p.y;
                }
                cx /= obj.points.length;
                cy /= obj.points.length;
                
                this.floorWaypoints.push({
                    id: obj.id,
                    x: cx,
                    y: cy,
                    obj: obj
                });
            }
        }
        
        this.previewPaths = [];
        
        const objCX = objective.x + objective.width / 2;
        const objCY = objective.y + objective.height / 2;
        const defCX = defSpawn.x + defSpawn.width / 2;
        const defCY = defSpawn.y + defSpawn.height / 2;
        const offCX = offSpawn.x + offSpawn.width / 2;
        const offCY = offSpawn.y + offSpawn.height / 2;
        
        const defColors = ['#27ae60', '#2ecc71', '#58d68d', '#82e0aa', '#abebc6'];
        const offColors = ['#e74c3c', '#ec7063', '#f1948a', '#f5b7b1', '#fadbd8'];
        
        // 각 waypoint 조합으로 다양한 경로 생성
        if (this.floorWaypoints.length > 0) {
            // Defence 경로들 - 각 waypoint를 경유하는 경로
            for (let i = 0; i < this.floorWaypoints.length; i++) {
                const wp = this.floorWaypoints[i];
                
                // Spawn -> Waypoint -> Objective 경로
                const path1 = this.findPath(defCX, defCY, wp.x, wp.y, this.navGrid, 0);
                const path2 = this.findPath(wp.x, wp.y, objCX, objCY, this.navGrid, 0);
                
                if (path1 && path2) {
                    const combinedPath = [...path1, ...path2.slice(1)];
                    this.previewPaths.push({
                        team: 'defence',
                        path: combinedPath,
                        waypoint: wp,
                        color: defColors[i % defColors.length]
                    });
                }
            }
            
            // Offence 경로들 - 각 waypoint를 경유하는 경로
            for (let i = 0; i < this.floorWaypoints.length; i++) {
                const wp = this.floorWaypoints[i];
                
                const path1 = this.findPath(offCX, offCY, wp.x, wp.y, this.navGrid, 0);
                const path2 = this.findPath(wp.x, wp.y, objCX, objCY, this.navGrid, 0);
                
                if (path1 && path2) {
                    const combinedPath = [...path1, ...path2.slice(1)];
                    this.previewPaths.push({
                        team: 'offence',
                        path: combinedPath,
                        waypoint: wp,
                        color: offColors[i % offColors.length]
                    });
                }
            }
        }
        
        // waypoint가 없거나 적으면 기본 직접 경로도 추가
        const defDirect = this.findPath(defCX, defCY, objCX, objCY, this.navGrid, 0);
        if (defDirect) {
            this.previewPaths.push({
                team: 'defence',
                path: defDirect,
                waypoint: null,
                color: '#1a5a3a'
            });
        }
        
        const offDirect = this.findPath(offCX, offCY, objCX, objCY, this.navGrid, 0);
        if (offDirect) {
            this.previewPaths.push({
                team: 'offence',
                path: offDirect,
                waypoint: null,
                color: '#8b1a1a'
            });
        }
        
        this.showPreview = true;
        
        const defRoutes = this.previewPaths.filter(p => p.team === 'defence').length;
        const offRoutes = this.previewPaths.filter(p => p.team === 'offence').length;
        document.getElementById('simStatus').innerHTML = 
            `<span style="color:#27ae60">DEF: ${defRoutes}개 루트</span> | <span style="color:#e74c3c">OFF: ${offRoutes}개 루트</span> (${this.floorWaypoints.length}개 waypoint)`;
        
        this.render();
    }
    
    // 두 경로가 비슷한지 체크
    isSimilarPath(path1, path2) {
        if (!path1 || !path2) return false;
        if (Math.abs(path1.length - path2.length) > path1.length * 0.3) return false;
        
        // 중간 지점들이 비슷한지 체크
        const checkPoints = [0.25, 0.5, 0.75];
        let similar = true;
        
        for (const ratio of checkPoints) {
            const idx1 = Math.floor(path1.length * ratio);
            const idx2 = Math.floor(path2.length * ratio);
            const p1 = path1[idx1];
            const p2 = path2[idx2];
            
            if (p1 && p2) {
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist > this.gridSize * 5) {  // 5m 이상 차이나면 다른 경로
                    similar = false;
                    break;
                }
            }
        }
        
        return similar;
    }
    
    // 미리보기 경로 그리기
    drawPreviewPaths(ctx) {
        if (!this.showPreview || this.previewPaths.length === 0) return;
        
        // 먼저 모든 waypoint 마커 표시
        if (this.floorWaypoints) {
            for (let i = 0; i < this.floorWaypoints.length; i++) {
                const wp = this.floorWaypoints[i];
                
                // Waypoint 다이아몬드 마커
                const size = 15;
                ctx.beginPath();
                ctx.moveTo(wp.x, wp.y - size);
                ctx.lineTo(wp.x + size, wp.y);
                ctx.lineTo(wp.x, wp.y + size);
                ctx.lineTo(wp.x - size, wp.y);
                ctx.closePath();
                ctx.fillStyle = '#9b59b6';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Waypoint 번호
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((i + 1).toString(), wp.x, wp.y);
            }
        }
        
        // 경로 그리기
        for (const route of this.previewPaths) {
            if (!route.path || route.path.length < 2) continue;
            
            ctx.beginPath();
            ctx.moveTo(route.path[0].x, route.path[0].y);
            
            for (let i = 1; i < route.path.length; i++) {
                ctx.lineTo(route.path[i].x, route.path[i].y);
            }
            
            ctx.strokeStyle = route.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
    
    handleRespawn() {
        const now = performance.now();
        const defSpawn = this.objects.find(o => o.type === 'spawn-def');
        const offSpawn = this.objects.find(o => o.type === 'spawn-off');
        const objective = this.objects.find(o => o.type === 'objective');
        
        if (!defSpawn || !offSpawn || !objective) return;
        
        for (let i = this.simAgents.length - 1; i >= 0; i--) {
            const agent = this.simAgents[i];
            
            if (agent.state === 'dead' && agent.deathTime) {
                // 리스폰 시간이 지났으면
                if (now - agent.deathTime > this.simRespawnTime) {
                    // 스폰 위치로 리스폰
                    const spawn = agent.team === 'defence' ? defSpawn : offSpawn;
                    const cx = spawn.x + spawn.width / 2;
                    const cy = spawn.y + spawn.height / 2;
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 30;
                    
                    agent.x = cx + Math.cos(angle) * dist;
                    agent.y = cy + Math.sin(angle) * dist;
                    agent.hp = 5;
                    agent.state = 'moving';
                    agent.deathTime = null;
                    agent.angle = Math.random() * Math.PI * 2;
                    
                    // A* 경로 재계산 (랜덤 경로 분산)
                    const objCX = objective.x + objective.width / 2;
                    const objCY = objective.y + objective.height / 2;
                    const randomFactor = 3 + Math.random() * 5;  // 3~8 랜덤 비용
                    const path = this.findPath(agent.x, agent.y, objCX, objCY, this.navGrid, randomFactor);
                    // simplifyPath 비활성화 - 원본 A* 경로 사용
                    agent.path = path;
                    agent.pathIndex = 0;
                }
            }
        }
    }
    
    simLoop() {
        if (!this.simRunning) return;
        
        const now = performance.now();
        const dt = (now - this.simLastTime) / 1000;  // 초 단위
        this.simLastTime = now;
        
        // 에이전트 업데이트
        this.updateAgents(dt);
        
        // 리스폰 처리
        this.handleRespawn();
        
        // 스코어 업데이트
        document.getElementById('simStatus').innerHTML = 
            `<span style="color:#27ae60">DEF: ${this.simScore.defence}</span> | <span style="color:#e74c3c">OFF: ${this.simScore.offence}</span>`;
        
        // 렌더링
        this.render();
        
        // 다음 프레임
        if (this.simRunning) {
            requestAnimationFrame(() => this.simLoop());
        }
    }
    
    updateAgents(dt) {
        const speedPx = this.simSpeed * this.pixelsPerMeter;  // 픽셀/초
        const viewRangePx = this.simViewRange * this.pixelsPerMeter;
        
        // 목표 재설정용 참조
        const defSpawn = this.objects.find(o => o.type === 'spawn-def');
        const offSpawn = this.objects.find(o => o.type === 'spawn-off');
        const objective = this.objects.find(o => o.type === 'objective');
        
        if (!defSpawn || !offSpawn || !objective) return;
        
        for (const agent of this.simAgents) {
            if (agent.state === 'dead') continue;
            
            // 적 탐지
            const enemies = this.simAgents.filter(a => 
                a.team !== agent.team && a.state !== 'dead'
            );
            
            let target = null;
            let minDist = viewRangePx;
            
            for (const enemy of enemies) {
                const dist = Math.hypot(enemy.x - agent.x, enemy.y - agent.y);
                if (dist < minDist) {
                    // 시야각 체크
                    const angleToEnemy = Math.atan2(enemy.y - agent.y, enemy.x - agent.x);
                    let angleDiff = Math.abs(angleToEnemy - agent.angle);
                    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                    
                    if (angleDiff < (this.simViewAngle / 2) * (Math.PI / 180)) {
                        // 시야 내에 있고, floor 기반 Line of Sight 체크 (벽 뒤는 안보임)
                        if (this.hasLineOfSight(agent.x, agent.y, enemy.x, enemy.y)) {
                            target = enemy;
                            minDist = dist;
                        }
                    }
                }
            }
            
            if (target) {
                // 적 발견 - 전투
                agent.state = 'fighting';
                agent.angle = Math.atan2(target.y - agent.y, target.x - agent.x);
                
                // 사격 (0.5초마다)
                if (performance.now() - agent.lastShot > 500) {
                    agent.lastShot = performance.now();
                    target.hp--;
                    
                    if (target.hp <= 0) {
                        target.state = 'dead';
                        target.deathTime = performance.now();
                        // 킬 스코어
                        if (agent.team === 'defence') {
                            this.simScore.defence++;
                        } else {
                            this.simScore.offence++;
                        }
                    }
                }
            } else {
                // 적 없음 - A* 경로를 따라 이동
                agent.state = 'moving';
                
                // 경로가 없거나 끝에 도달했으면 새 목표 설정
                if (!agent.path || agent.pathIndex >= agent.path.length) {
                    this.assignNewTarget(agent, objective, defSpawn, offSpawn);
                    continue;
                }
                
                // 현재 목표 지점
                const target = agent.path[agent.pathIndex];
                const dx = target.x - agent.x;
                const dy = target.y - agent.y;
                const dist = Math.hypot(dx, dy);
                
                // 경유점 도달 체크 (20px 이내)
                if (dist < 20) {
                    agent.pathIndex++;
                    if (agent.pathIndex >= agent.path.length) {
                        // 목표 도달 - 새 목표 설정
                        this.assignNewTarget(agent, objective, defSpawn, offSpawn);
                        continue;
                    }
                }
                
                // 이동 방향
                const moveAngle = Math.atan2(dy, dx);
                agent.angle = moveAngle;
                
                // 이동
                const newX = agent.x + Math.cos(moveAngle) * speedPx * dt;
                const newY = agent.y + Math.sin(moveAngle) * speedPx * dt;
                
                // floor 위에 있는지 체크
                if (this.isOnFloor(newX, newY)) {
                    agent.x = newX;
                    agent.y = newY;
                }
            }
        }
    }
    
    // 에이전트에게 새 목표 할당 (초크포인트 탐색 + 경로 다양화)
    assignNewTarget(agent, objective, defSpawn, offSpawn) {
        const objCX = objective.x + objective.width / 2;
        const objCY = objective.y + objective.height / 2;
        
        // 현재 위치에서 어디로 갈지 결정
        const distToObj = Math.hypot(agent.x - objCX, agent.y - objCY);
        const enemySpawn = agent.team === 'defence' ? offSpawn : defSpawn;
        const enemySpawnCX = enemySpawn.x + enemySpawn.width / 2;
        const enemySpawnCY = enemySpawn.y + enemySpawn.height / 2;
        
        let targetX, targetY;
        
        // 웨이포인트가 있으면 다양한 경로 사용
        if (this.floorWaypoints && this.floorWaypoints.length > 0) {
            // 랜덤하게 다음 행동 결정
            const action = Math.random();
            
            if (action < 0.4) {
                // 40%: 적 스폰으로 진격 (공격적)
                targetX = enemySpawnCX;
                targetY = enemySpawnCY;
            } else if (action < 0.7) {
                // 30%: 랜덤 웨이포인트로 순찰
                const wp = this.floorWaypoints[Math.floor(Math.random() * this.floorWaypoints.length)];
                targetX = wp.x;
                targetY = wp.y;
            } else {
                // 30%: Objective로 복귀/수비
                targetX = objCX;
                targetY = objCY;
            }
        } else {
            // 웨이포인트 없으면 적 스폰과 Objective 번갈아
            if (distToObj < 100) {
                // Objective 근처면 적 스폰으로
                targetX = enemySpawnCX;
                targetY = enemySpawnCY;
            } else {
                // 아니면 Objective로
                targetX = objCX;
                targetY = objCY;
            }
        }
        
        // 새 경로 계산 (다양성을 위한 랜덤 비용)
        const randomFactor = 2 + Math.random() * 6;
        const path = this.findPath(agent.x, agent.y, targetX, targetY, this.navGrid, randomFactor);
        
        if (path && path.length > 1) {
            agent.path = path;
            agent.pathIndex = 0;
        }
    }
    
    // 해당 좌표가 floor 위에 있는지 체크
    isOnFloor(x, y) {
        for (const obj of this.objects) {
            if (obj.floor !== this.currentFloor) continue;
            
            if (obj.type === 'floor-area') {
                if (x >= obj.x && x <= obj.x + obj.width &&
                    y >= obj.y && y <= obj.y + obj.height) {
                    return true;
                }
            } else if (obj.type === 'polyfloor' && obj.points) {
                if (this.isPointInPolygon(x, y, obj.points)) {
                    return true;
                }
            } else if (['spawn-def', 'spawn-off', 'objective'].includes(obj.type)) {
                if (x >= obj.x && x <= obj.x + obj.width &&
                    y >= obj.y && y <= obj.y + obj.height) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // 시뮬레이션 에이전트 렌더링 (render 함수에서 호출)
    renderSimAgents(ctx) {
        if (!this.simRunning && this.simAgents.length === 0) return;
        
        // 핀 렌더링
        if (this.pinLocation) {
            const px = this.pinLocation.x;
            const py = this.pinLocation.y;
            
            // 핀 그림자/글로우
            ctx.beginPath();
            ctx.arc(px, py, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(243, 156, 18, 0.3)';
            ctx.fill();
            
            // 핀 마커 (맵핀 모양)
            ctx.beginPath();
            ctx.arc(px, py - 15, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#f39c12';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 핀 꼬리
            ctx.beginPath();
            ctx.moveTo(px - 8, py - 8);
            ctx.lineTo(px, py + 5);
            ctx.lineTo(px + 8, py - 8);
            ctx.fillStyle = '#f39c12';
            ctx.fill();
            
            // 핀 중심점
            ctx.beginPath();
            ctx.arc(px, py - 15, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            
            // 핀 텍스트
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = '#f39c12';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('📍 집결 지점', px, py - 32);
        }
        
        // 먼저 경로 그리기 (에이전트 뒤에)
        for (const agent of this.simAgents) {
            if (agent.state === 'dead' || !agent.path || agent.pathIndex >= agent.path.length) continue;
            
            ctx.beginPath();
            ctx.moveTo(agent.x, agent.y);
            for (let i = agent.pathIndex; i < agent.path.length; i++) {
                ctx.lineTo(agent.path[i].x, agent.path[i].y);
            }
            ctx.strokeStyle = agent.color + '44';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        for (const agent of this.simAgents) {
            // 죽은 에이전트는 그리지 않음
            if (agent.state === 'dead') continue;
            
            ctx.save();
            ctx.translate(agent.x, agent.y);
            ctx.rotate(agent.angle);
            
            // 상태에 따른 색상
            let color = agent.color;
            if (agent.state === 'fighting') {
                color = agent.team === 'defence' ? '#2ecc71' : '#ff6b6b';
            }
            
            // 몸체 (원)
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 방향 표시 (삼각형)
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(8, -6);
            ctx.lineTo(8, 6);
            ctx.closePath();
            ctx.fillStyle = '#fff';
            ctx.fill();
            
            // HP 표시
            ctx.rotate(-agent.angle);  // 텍스트 회전 취소
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(agent.hp.toString(), 0, 0);
            
            // 시야 범위 (전투 중일 때만)
            if (agent.state === 'fighting') {
                ctx.rotate(agent.angle);  // 다시 회전
                const viewRangePx = this.simViewRange * this.pixelsPerMeter;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, viewRangePx, -this.simViewAngle/2 * Math.PI/180, this.simViewAngle/2 * Math.PI/180);
                ctx.closePath();
                ctx.fillStyle = `${color}22`;
                ctx.fill();
            }
            
            ctx.restore();
        }
    }
    
    // ========== RECENT FILES ==========
    addToRecentFiles(filename) {
        const entry = {
            name: filename,
            date: new Date().toISOString()
        };
        
        // 이미 있으면 제거 (맨 앞으로 이동)
        this.recentFiles = this.recentFiles.filter(f => f.name !== filename);
        
        // 맨 앞에 추가
        this.recentFiles.unshift(entry);
        
        // 최대 10개 유지
        if (this.recentFiles.length > 10) {
            this.recentFiles = this.recentFiles.slice(0, 10);
        }
        
        // 저장
        localStorage.setItem('levelforge_recentFiles', JSON.stringify(this.recentFiles));
    }
    
    toggleRecentDropdown() {
        const dropdown = document.getElementById('recentDropdown');
        if (!dropdown) return;
        
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            this.updateRecentList();
        }
    }
    
    updateRecentList() {
        const list = document.getElementById('recentList');
        const empty = document.getElementById('recentEmpty');
        if (!list || !empty) return;
        
        if (this.recentFiles.length === 0) {
            list.style.display = 'none';
            empty.style.display = 'block';
            return;
        }
        
        list.style.display = 'block';
        empty.style.display = 'none';
        
        list.innerHTML = this.recentFiles.map(f => {
            const date = new Date(f.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            return `
                <li data-filename="${f.name}">
                    <i class="fa-solid fa-file-lines"></i>
                    <span class="recent-name">${f.name}</span>
                    <span class="recent-date">${dateStr}</span>
                </li>
            `;
        }).join('');
        
        // 클릭 이벤트
        list.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => {
                const filename = li.dataset.filename;
                this.openRecentFile(filename);
                document.getElementById('recentDropdown').style.display = 'none';
            });
        });
    }
    
    async openRecentFile(filename) {
        // File System Access API로 파일 열기 시도
        // 보안상 직접 파일 경로로 열 수 없으므로, 파일 선택 다이얼로그를 열고 안내
        this.showToast(`📂 "${filename}" 파일을 선택해주세요`);
        
        if (window.showOpenFilePicker) {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'LEVELFORGE 파일',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                
                const file = await fileHandle.getFile();
                const content = await file.text();
                this._openedFileHandle = fileHandle;
                this.loadFileContent(content, file.name);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.log('파일 열기 취소됨');
                }
            }
        } else {
            document.getElementById('fileInput').click();
        }
    }

    // ========== AI ASSISTANT ==========
    toggleAIPanel(show = null) {
        const panel = document.getElementById('aiPanel');
        if (!panel) return;
        
        const isVisible = panel.style.display !== 'none';
        const shouldShow = show !== null ? show : !isVisible;
        
        panel.style.display = shouldShow ? 'flex' : 'none';
        
        if (shouldShow) {
            document.getElementById('aiInput')?.focus();
        }
    }
    
    toggleAIChat() {
        const messages = document.getElementById('aiMessages');
        const inputArea = document.querySelector('.ai-input-area');
        const isHidden = messages?.style.display === 'none';
        
        if (messages) messages.style.display = isHidden ? 'flex' : 'none';
        if (inputArea) inputArea.style.display = isHidden ? 'flex' : 'none';
    }
    
    updateAIStatus(text, type = 'info') {
        const bar = document.getElementById('aiStatusBar');
        const textEl = document.getElementById('aiStatusText');
        if (bar && textEl) {
            bar.style.display = 'flex';
            textEl.textContent = text;
            bar.className = `ai-status-bar ai-status-${type}`;
        }
    }
    
    hideAIStatus() {
        const bar = document.getElementById('aiStatusBar');
        if (bar) bar.style.display = 'none';
    }
    
    // 기존 바닥들의 연결 가능한 edge 분석
    analyzeFloorEdges() {
        const floors = this.objects.filter(o => o.type === 'polyfloor' && o.points?.length >= 3);
        const edges = [];
        
        floors.forEach(floor => {
            const pts = floor.points;
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                
                // 4m 이상 edge만
                if (length >= 128) {
                    edges.push({
                        floorId: floor.id,
                        floorLabel: floor.label || `Floor ${floor.id}`,
                        p1: { x: p1.x, y: p1.y },
                        p2: { x: p2.x, y: p2.y },
                        mid: { x: midX, y: midY },
                        length: Math.round(length / 32),
                        direction: this.getEdgeDirection(p1, p2)
                    });
                }
            }
        });
        
        return edges;
    }
    
    getEdgeDirection(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            return dy >= 0 ? 'south' : 'north';  // 수평 edge
        } else {
            return dx >= 0 ? 'east' : 'west';    // 수직 edge
        }
    }
    
    // 연결되지 않은 edge 쌍 찾기
    findDisconnectedEdgePairs() {
        const edges = this.analyzeFloorEdges();
        const pairs = [];
        
        for (let i = 0; i < edges.length; i++) {
            for (let j = i + 1; j < edges.length; j++) {
                const e1 = edges[i];
                const e2 = edges[j];
                
                // 같은 floor면 스킵
                if (e1.floorId === e2.floorId) continue;
                
                // 거리 계산
                const dist = Math.sqrt((e1.mid.x - e2.mid.x) ** 2 + (e1.mid.y - e2.mid.y) ** 2);
                
                // 2m~30m 거리의 마주보는 edge
                if (dist >= 64 && dist <= 960) {
                    const isOpposite = 
                        (e1.direction === 'north' && e2.direction === 'south') ||
                        (e1.direction === 'south' && e2.direction === 'north') ||
                        (e1.direction === 'east' && e2.direction === 'west') ||
                        (e1.direction === 'west' && e2.direction === 'east');
                    
                    if (isOpposite || dist < 300) {
                        pairs.push({
                            edge1: e1,
                            edge2: e2,
                            distance: Math.round(dist / 32)
                        });
                    }
                }
            }
        }
        
        // 거리순 정렬
        pairs.sort((a, b) => a.distance - b.distance);
        return pairs.slice(0, 5);  // 상위 5개
    }
    
    // ========== 인터렉티브 통로 연결 ==========
    
    // 가장 가까운 edge 찾기
    findNearestEdge(x, y, maxDist = 20) {
        const floors = this.objects.filter(o => 
            (o.type === 'polyfloor' && o.points?.length >= 3) ||
            (o.type === 'spawn-def' || o.type === 'spawn-off' || o.type === 'objective')
        );
        
        let nearest = null;
        let minDist = maxDist * this.camera.zoom;  // 화면 픽셀 기준
        
        for (const floor of floors) {
            // points 가져오기 (마커는 사각형으로 변환)
            let pts;
            if (floor.points) {
                pts = floor.points;
            } else if (floor.width && floor.height) {
                pts = [
                    { x: floor.x, y: floor.y },
                    { x: floor.x + floor.width, y: floor.y },
                    { x: floor.x + floor.width, y: floor.y + floor.height },
                    { x: floor.x, y: floor.y + floor.height }
                ];
            } else {
                continue;
            }
            
            // 각 edge와의 거리
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                
                // 점과 선분 사이의 거리 및 최근접점
                const result = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
                
                if (result.dist < minDist) {
                    minDist = result.dist;
                    nearest = {
                        floor: floor,
                        p1: p1,
                        p2: p2,
                        point: { x: result.nearX, y: result.nearY },
                        edgeIndex: i
                    };
                }
            }
        }
        
        return nearest;
    }
    
    // 점과 선분 사이의 거리 계산
    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        
        let t = 0;
        if (lenSq > 0) {
            t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
        }
        
        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;
        const dist = Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
        
        return { dist, nearX, nearY, t };
    }
    
    // 통로 연결 클릭 핸들러 (경유점 지원)
    handleCorridorClick(x, y, isDoubleClick = false) {
        const edge = this.findNearestEdge(x, y, 30);
        const width = (parseInt(document.getElementById('splineWidth')?.value) || 160);
        const snapped = this.snap(x, y);
        
        if (!this.corridorStart) {
            // 시작점 선택 (edge 필요)
            if (!edge) {
                this.showToast('바닥의 edge를 클릭하여 시작점을 선택하세요');
                return;
            }
            this.corridorStart = edge;
            this.corridorWaypoints = [];
            this.showToast('시작점 선택됨. 경유점을 클릭하거나, 끝 edge를 더블클릭/Enter');
            this.render();
        } else if (edge && (isDoubleClick || edge.floor.id !== this.corridorStart.floor.id)) {
            // 끝점 선택 (edge 클릭 + 더블클릭 또는 다른 바닥)
            if (edge.floor.id === this.corridorStart.floor.id && !isDoubleClick) {
                // 같은 바닥이고 더블클릭이 아니면 경유점 추가
                this.corridorWaypoints.push({ x: snapped.x, y: snapped.y });
                this.showToast(`경유점 ${this.corridorWaypoints.length}개. 계속 클릭하거나 끝 edge에서 더블클릭/Enter`);
                this.render();
                return;
            }
            
            // 통로 생성
            this.createInteractiveCorridor(this.corridorStart, edge, width, this.corridorWaypoints);
            
            // 리셋
            this.corridorStart = null;
            this.corridorWaypoints = [];
            this.showToast('통로가 생성되었습니다');
        } else {
            // 경유점 추가 (빈 공간 클릭)
            this.corridorWaypoints.push({ x: snapped.x, y: snapped.y });
            this.showToast(`경유점 ${this.corridorWaypoints.length}개. 계속 클릭하거나 끝 edge 클릭`);
            this.render();
        }
    }
    
    // 통로 완성 (Enter 키)
    finishCorridor() {
        if (!this.corridorStart) return;
        
        const edge = this.corridorHoverEdge;
        if (edge && edge.floor.id !== this.corridorStart.floor.id) {
            const width = (parseInt(document.getElementById('splineWidth')?.value) || 160);
            this.createInteractiveCorridor(this.corridorStart, edge, width, this.corridorWaypoints);
            this.corridorStart = null;
            this.corridorWaypoints = [];
            this.showToast('통로가 생성되었습니다');
        } else {
            this.showToast('끝점 edge 위에서 Enter를 누르세요');
        }
    }
    
    // 인터렉티브 통로 생성 (Edge 위 버텍스 + 경유점 지원)
    createInteractiveCorridor(start, end, width, waypoints = []) {
        const halfW = width / 2;
        
        // 시작 edge의 두 점
        const sEdgePts = this.getPointsOnEdge(start.p1, start.p2, start.point, halfW);
        // 끝 edge의 두 점
        const eEdgePts = this.getPointsOnEdge(end.p1, end.p2, end.point, halfW);
        
        // 모든 중심점 경로: 시작점 → 경유점들 → 끝점
        const centerPath = [
            start.point,
            ...waypoints,
            end.point
        ];
        
        // 왼쪽 변과 오른쪽 변의 점들 계산
        const leftPoints = [];
        const rightPoints = [];
        
        for (let i = 0; i < centerPath.length; i++) {
            const curr = centerPath[i];
            
            // 이전/다음 점으로 방향 계산
            let dir;
            if (i === 0) {
                // 시작점: 다음 점 방향
                const next = centerPath[i + 1];
                dir = { x: next.x - curr.x, y: next.y - curr.y };
            } else if (i === centerPath.length - 1) {
                // 끝점: 이전 점에서 오는 방향
                const prev = centerPath[i - 1];
                dir = { x: curr.x - prev.x, y: curr.y - prev.y };
            } else {
                // 중간점: 이전→다음 방향의 평균
                const prev = centerPath[i - 1];
                const next = centerPath[i + 1];
                dir = { 
                    x: (next.x - prev.x), 
                    y: (next.y - prev.y) 
                };
            }
            
            // 방향 정규화
            const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
            if (len > 0) {
                dir.x /= len;
                dir.y /= len;
            }
            
            // 수직 방향 (왼쪽/오른쪽)
            const perpX = -dir.y * halfW;
            const perpY = dir.x * halfW;
            
            if (i === 0) {
                // 시작점: edge 위의 점 사용
                leftPoints.push({ x: sEdgePts.p1.x, y: sEdgePts.p1.y, z: 0 });
                rightPoints.push({ x: sEdgePts.p2.x, y: sEdgePts.p2.y, z: 0 });
            } else if (i === centerPath.length - 1) {
                // 끝점: edge 위의 점 사용 (순서 맞춤)
                // 왼쪽 점과 더 가까운 것을 왼쪽에
                const distL1 = Math.hypot(leftPoints[leftPoints.length-1].x - eEdgePts.p1.x, 
                                          leftPoints[leftPoints.length-1].y - eEdgePts.p1.y);
                const distL2 = Math.hypot(leftPoints[leftPoints.length-1].x - eEdgePts.p2.x, 
                                          leftPoints[leftPoints.length-1].y - eEdgePts.p2.y);
                
                if (distL1 <= distL2) {
                    leftPoints.push({ x: eEdgePts.p1.x, y: eEdgePts.p1.y, z: 0 });
                    rightPoints.push({ x: eEdgePts.p2.x, y: eEdgePts.p2.y, z: 0 });
                } else {
                    leftPoints.push({ x: eEdgePts.p2.x, y: eEdgePts.p2.y, z: 0 });
                    rightPoints.push({ x: eEdgePts.p1.x, y: eEdgePts.p1.y, z: 0 });
                }
            } else {
                // 중간 경유점
                leftPoints.push({ x: curr.x + perpX, y: curr.y + perpY, z: 0 });
                rightPoints.push({ x: curr.x - perpX, y: curr.y - perpY, z: 0 });
            }
        }
        
        // 다각형 버텍스: 왼쪽 점들 → 오른쪽 점들 (역순)
        const vertices = [
            ...leftPoints,
            ...rightPoints.reverse()
        ];
        
        // Polyfloor 생성
        const corridor = this.createPolyfloor(vertices);
        this.objects.push(corridor);
        
        this.saveState();
        this.updateObjectsList();
        this.render();
    }
    
    // Edge 위에서 중심점 기준 양쪽으로 halfW만큼의 두 점
    getPointsOnEdge(p1, p2, center, halfW) {
        // Edge 방향 벡터
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        
        return {
            p1: { x: center.x - ux * halfW, y: center.y - uy * halfW },
            p2: { x: center.x + ux * halfW, y: center.y + uy * halfW }
        };
    }
    
    // Edge의 바깥쪽 법선 벡터 (바닥 중심에서 멀어지는 방향)
    getEdgeOutwardNormal(p1, p2, floor) {
        // Edge 방향
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        // 법선 (오른쪽 90도 회전)
        let nx = -dy / len;
        let ny = dx / len;
        
        // 바닥 중심
        const pts = floor.points || [
            { x: floor.x, y: floor.y },
            { x: floor.x + floor.width, y: floor.y },
            { x: floor.x + floor.width, y: floor.y + floor.height },
            { x: floor.x, y: floor.y + floor.height }
        ];
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        
        // Edge 중점
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        
        // 법선이 중심에서 멀어지는 방향인지 확인
        const toCenterX = cx - mx;
        const toCenterY = cy - my;
        
        if (nx * toCenterX + ny * toCenterY > 0) {
            // 법선이 중심을 향함 → 반대로
            nx = -nx;
            ny = -ny;
        }
        
        return { x: nx, y: ny };
    }
    
    // polyfloor 생성 헬퍼
    createPolyfloor(points, label = 'Corridor') {
        return {
            id: this.nextId++,
            type: 'polyfloor',
            category: 'floors',
            floor: this.currentFloor,
            color: 'hsla(200, 55%, 50%, 0.6)',
            points: points,
            floorHeight: 0,
            closed: true,
            label: label
        };
    }
    
    // ========== 프로시저럴 레벨 생성 ==========
    // 로직은 procedural.js에 분리됨
    
    proceduralConnect() {
        const width = (parseInt(document.getElementById('corridorWidth')?.value) || 5) * 32;
        
        // ProceduralGenerator 사용
        if (!this.procedural) {
            this.procedural = new ProceduralGenerator(this);
        }
        
        const result = this.procedural.connect(width);
        
        if (!result.success && result.corridors.length === 0) {
            this.updateAIStatus(result.message || '연결할 수 없습니다', 'warning');
            this.showToast(result.message);
            return;
        }
        
        if (result.corridors.length > 0) {
            this.aiPendingObjects = result.corridors;
            this.aiSelectedIndices = new Set(result.corridors.map((_, i) => i));
            this.addAIActionButtons(`${result.corridors.length}개 통로`);
            this.updateAIStatus(`✅ ${result.corridors.length}개 통로 생성됨`, 'success');
            this.showToast(result.message);
            this.render();
        } else {
            this.updateAIStatus(result.message, 'warning');
            this.showToast(result.message);
        }
    }
    
    proceduralExpand() {
        this.showToast('영역 확장 기능은 준비 중입니다');
    }
    
    // ========== Python Procedural API 연동 ==========
    
    // 경로 연결 모드
    pathConnectMode = false;
    pathConnectStart = null;
    
    startPathConnect() {
        this.pathConnectMode = true;
        this.pathConnectStart = null;
        this.currentTool = 'path-connect';
        this.showToast('첫 번째 점을 클릭하세요 (ESC로 취소)');
        this.mainCanvas.style.cursor = 'crosshair';
    }
    
    cancelPathConnect() {
        this.pathConnectMode = false;
        this.pathConnectStart = null;
        this.currentTool = 'select';
        this.mainCanvas.style.cursor = 'default';
        this.render();
    }
    
    // 클릭 위치에서 가장 가까운 오브젝트의 엣지 찾기
    findNearestEdge(worldX, worldY, maxDist = 100) {
        let nearest = null;
        let minDist = maxDist;
        
        for (const obj of this.objects) {
            if (obj.type !== 'polyfloor' || !obj.points || obj.points.length < 3) continue;
            
            const points = obj.points;
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                
                // 점에서 선분까지 거리 및 가장 가까운 점
                const result = this.pointToSegment(worldX, worldY, p1.x, p1.y, p2.x, p2.y);
                
                if (result.dist < minDist) {
                    minDist = result.dist;
                    nearest = {
                        obj: obj,
                        edgeIndex: i,
                        point: { x: result.x, y: result.y },
                        p1: p1,
                        p2: p2,
                        dist: result.dist
                    };
                }
            }
        }
        return nearest;
    }
    
    // 점에서 선분까지 거리와 가장 가까운 점
    pointToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        
        let t = 0;
        if (len2 > 0) {
            t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        }
        
        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;
        const dist = Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
        
        return { x: nearX, y: nearY, dist: dist, t: t };
    }
    
    // 직교 경로 생성 (L자 또는 ㄱ자) - 항상 꺾임
    createOrthogonalPath(start, end, width = 160) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const halfW = width / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const corridors = [];
        
        // 거리가 짧으면 직선
        if (dist < 200) {
            // 직선 연결 (가로 또는 세로)
            if (Math.abs(dx) > Math.abs(dy)) {
                const minX = Math.min(start.x, end.x);
                const maxX = Math.max(start.x, end.x);
                corridors.push(this.createRectCorridor(minX, start.y - halfW, maxX - minX + width, width));
            } else {
                const minY = Math.min(start.y, end.y);
                const maxY = Math.max(start.y, end.y);
                corridors.push(this.createRectCorridor(start.x - halfW, minY, width, maxY - minY + width));
            }
            return corridors;
        }
        
        // 긴 거리: 항상 L자로 꺾기
        // 중간점 결정 (가로 먼저 또는 세로 먼저 랜덤)
        const horizontal = Math.random() > 0.5;
        let mid;
        
        if (horizontal) {
            // 가로 → 세로
            mid = { x: end.x, y: start.y };
            
            // 가로 통로
            const minX = Math.min(start.x, mid.x);
            const maxX = Math.max(start.x, mid.x);
            corridors.push(this.createRectCorridor(minX, start.y - halfW, maxX - minX + width, width));
            
            // 세로 통로
            const minY = Math.min(mid.y, end.y);
            const maxY = Math.max(mid.y, end.y);
            corridors.push(this.createRectCorridor(end.x - halfW, minY, width, maxY - minY + width));
        } else {
            // 세로 → 가로
            mid = { x: start.x, y: end.y };
            
            // 세로 통로
            const minY = Math.min(start.y, mid.y);
            const maxY = Math.max(start.y, mid.y);
            corridors.push(this.createRectCorridor(start.x - halfW, minY, width, maxY - minY + width));
            
            // 가로 통로
            const minX = Math.min(mid.x, end.x);
            const maxX = Math.max(mid.x, end.x);
            corridors.push(this.createRectCorridor(minX, end.y - halfW, maxX - minX + width, width));
        }
        
        return corridors;
    }
    
    // 직사각형 통로 생성
    createRectCorridor(x, y, w, h) {
        return {
            type: 'polyfloor',
            x: x + w / 2,
            y: y + h / 2,
            width: w,
            height: h,
            points: [
                { x: x, y: y },
                { x: x + w, y: y },
                { x: x + w, y: y + h },
                { x: x, y: y + h }
            ],
            floorHeight: 0,
            closed: true,
            label: ''
        };
    }
    
    // 경로가 기존 오브젝트와 겹치는지 체크
    doesPathOverlap(corridor, excludeIds = []) {
        for (const obj of this.objects) {
            if (obj.type !== 'polyfloor' || excludeIds.includes(obj.id)) continue;
            
            // 간단한 AABB 겹침 체크
            const c = corridor;
            const cMinX = Math.min(...c.points.map(p => p.x));
            const cMaxX = Math.max(...c.points.map(p => p.x));
            const cMinY = Math.min(...c.points.map(p => p.y));
            const cMaxY = Math.max(...c.points.map(p => p.y));
            
            if (!obj.points || obj.points.length < 3) continue;
            
            const oMinX = Math.min(...obj.points.map(p => p.x));
            const oMaxX = Math.max(...obj.points.map(p => p.x));
            const oMinY = Math.min(...obj.points.map(p => p.y));
            const oMaxY = Math.max(...obj.points.map(p => p.y));
            
            // 완전히 겹치면 제외 (터치는 OK)
            const overlapX = cMinX < oMaxX - 5 && cMaxX > oMinX + 5;
            const overlapY = cMinY < oMaxY - 5 && cMaxY > oMinY + 5;
            
            if (overlapX && overlapY) return true;
        }
        return false;
    }
    
    async handlePathConnectClick(worldX, worldY) {
        // 가장 가까운 엣지 찾기
        const edge = this.findNearestEdge(worldX, worldY, 200);
        
        if (!this.pathConnectStart) {
            // 첫 번째 점
            if (edge) {
                this.pathConnectStart = { 
                    x: edge.point.x, 
                    y: edge.point.y,
                    edge: edge
                };
                this.showToast('엣지 감지됨! 두 번째 엣지를 클릭하세요');
            } else {
                this.pathConnectStart = { x: worldX, y: worldY, edge: null };
                this.showToast('두 번째 점을 클릭하세요 (엣지 근처 권장)');
            }
            this.render();
            
            // 시작점 시각적 표시
            const pt = this.pathConnectStart;
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(this.pan.x, this.pan.y);
            ctx.scale(this.zoom, this.zoom);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#4ecdc4';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else {
            // 두 번째 점
            let endPoint;
            if (edge) {
                endPoint = { x: edge.point.x, y: edge.point.y, edge: edge };
            } else {
                endPoint = { x: worldX, y: worldY, edge: null };
            }
            
            const start = this.pathConnectStart;
            
            // 기존 오브젝트 정보 수집 (겹침 방지용)
            const existingObjects = this.objects
                .filter(o => o.type === 'polyfloor' && o.points && o.points.length >= 3)
                .map(o => ({
                    id: o.id,
                    points: o.points
                }));
            
            this.showToast('프로시저럴 경로 생성 중...');
            
            try {
                const response = await fetch('http://localhost:3003/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        start: { x: start.x, y: start.y },
                        end: { x: endPoint.x, y: endPoint.y },
                        options: {
                            width: 5,
                            procedural: true,
                            existing_objects: existingObjects
                        }
                    })
                });
                
                if (!response.ok) throw new Error('API 오류');
                
                const data = await response.json();
                
                if (data.objects && data.objects.length > 0) {
                    data.objects.forEach(obj => {
                        obj.id = this.nextId++;
                        obj.floor = this.currentFloor;
                        this.objects.push(obj);
                    });
                    
                    this.showToast(`${data.objects.length}개 오브젝트 생성됨`);
                    this.saveState();
                } else {
                    this.showToast('경로를 생성할 수 없습니다');
                }
            } catch (err) {
                console.error('경로 생성 오류:', err);
                this.showToast('서버 연결 실패');
            }
            
            // 모드 종료
            this.cancelPathConnect();
        }
    }
    
    showProceduralDialog() {
        document.getElementById('proceduralModal').style.display = 'flex';
        this.initPreviewCanvas();
    }
    
    closeProceduralDialog() {
        document.getElementById('proceduralModal').style.display = 'none';
    }
    
    // ========== 프리뷰 캔버스 ==========
    previewPoints = null;
    previewDragging = null;
    previewConnections = null;  // 연결선 배열 [{from: 'atk', to: 'mid'}, ...]
    previewConnecting = null;   // Shift+드래그 중 시작 노드
    previewHoveredNode = null;  // 호버 중인 노드
    
    initPreviewCanvas() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        // 기본 포인트 위치 설정
        const siteCount = parseInt(document.querySelector('input[name="siteCount"]:checked')?.value || '2');
        
        if (!this.previewPoints) {
            this.previewPoints = {
                // 스폰
                atk: { x: w / 2, y: h - 50, color: '#e74c3c', label: 'ATK', size: 20 },
                def: { x: w / 2, y: 50, color: '#3498db', label: 'DEF', size: 20 },
                // 사이트
                siteA: { x: w / 5, y: h / 5, color: '#f1c40f', label: 'A', size: 22 },
                siteB: { x: 4 * w / 5, y: h / 5, color: '#f1c40f', label: 'B', size: 22 },
                siteC: { x: w / 2, y: h / 7, color: '#f1c40f', label: 'C', size: 22 },
                // 미드
                mid: { x: w / 2, y: h / 2, color: '#9b59b6', label: 'MID', size: 16 },
                // 랑데뷰 포인트 (SIDE - 플랭크)
                sideA: { x: w / 6, y: h * 0.4, color: '#1abc9c', label: 'A側', size: 14 },
                sideB: { x: 5 * w / 6, y: h * 0.4, color: '#1abc9c', label: 'B側', size: 14 },
                // 로비 (진입 전 대기)
                lobbyA: { x: w / 4, y: h * 0.6, color: '#e67e22', label: 'A入', size: 14 },
                lobbyB: { x: 3 * w / 4, y: h * 0.6, color: '#e67e22', label: 'B入', size: 14 },
            };
        }
        
        // 기본 연결선 초기화
        if (!this.previewConnections) {
            this.resetConnections();
        }
        
        // 이벤트 리스너 (한 번만)
        if (!canvas._hasListeners) {
            canvas._hasListeners = true;
            
            canvas.addEventListener('mousedown', (e) => this.onPreviewMouseDown(e));
            canvas.addEventListener('mousemove', (e) => this.onPreviewMouseMove(e));
            canvas.addEventListener('click', (e) => this.onPreviewClick(e));
            canvas.addEventListener('mouseup', (e) => this.onPreviewMouseUp(e));
            canvas.addEventListener('mouseleave', (e) => this.onPreviewMouseUp(e));
        }
        
        // 사이트 개수 변경 이벤트
        document.querySelectorAll('input[name="siteCount"]').forEach(radio => {
            radio.addEventListener('change', () => this.renderPreview());
        });
        
        this.renderPreview();
    }
    
    renderPreview() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas || !this.previewPoints) return;
        
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const siteCount = parseInt(document.querySelector('input[name="siteCount"]:checked')?.value || '2');
        
        // 배경
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, w, h);
        
        // 그리드
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        
        const pts = this.previewPoints;
        
        // 토글 상태
        const enableSideA = document.getElementById('enableSideA')?.checked ?? true;
        const enableSideB = document.getElementById('enableSideB')?.checked ?? true;
        const enableLobbyA = document.getElementById('enableLobbyA')?.checked ?? true;
        const enableLobbyB = document.getElementById('enableLobbyB')?.checked ?? true;
        
        // 룸 사이즈 가져오기
        const siteSizeMin = parseInt(document.getElementById('siteSizeMin')?.value || 24);
        const siteSizeMax = parseInt(document.getElementById('siteSizeMax')?.value || 32);
        const avgSiteSize = (siteSizeMin + siteSizeMax) / 2;
        
        // === 룸 사이즈 미리보기 (포인트 뒤에) ===
        // 스폰
        this.drawRoomPreview(ctx, pts.atk, 22, '#e74c3c');
        this.drawRoomPreview(ctx, pts.def, 20, '#3498db');
        
        // 사이트
        if (siteCount >= 1) this.drawRoomPreview(ctx, pts.siteA, avgSiteSize, '#f1c40f');
        if (siteCount >= 2) this.drawRoomPreview(ctx, pts.siteB, avgSiteSize, '#f1c40f');
        if (siteCount >= 3) this.drawRoomPreview(ctx, pts.siteC, avgSiteSize, '#f1c40f');
        
        // 미드
        this.drawRoomPreview(ctx, pts.mid, 24, '#9b59b6');
        
        // 랑데뷰 포인트
        if (siteCount >= 1 && enableSideA) this.drawRoomPreview(ctx, pts.sideA, 16, '#1abc9c');
        if (siteCount >= 2 && enableSideB) this.drawRoomPreview(ctx, pts.sideB, 16, '#1abc9c');
        if (siteCount >= 1 && enableLobbyA) this.drawRoomPreview(ctx, pts.lobbyA, 20, '#e67e22');
        if (siteCount >= 2 && enableLobbyB) this.drawRoomPreview(ctx, pts.lobbyB, 20, '#e67e22');
        
        // 연결선 그리기 (previewConnections 기반)
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        
        // X 버튼 위치 저장 (클릭용)
        this.connectionButtons = [];
        
        if (this.previewConnections) {
            for (let i = 0; i < this.previewConnections.length; i++) {
                const conn = this.previewConnections[i];
                const p1 = pts[conn.from];
                const p2 = pts[conn.to];
                if (!p1 || !p2) continue;
                
                // 비활성 노드 체크
                if (!this.isNodeEnabled(conn.from) || !this.isNodeEnabled(conn.to)) continue;
                
                // 사이트 개수 체크
                if ((conn.from === 'siteB' || conn.to === 'siteB') && siteCount < 2) continue;
                if ((conn.from === 'siteC' || conn.to === 'siteC') && siteCount < 3) continue;
                if ((conn.from === 'sideB' || conn.to === 'sideB') && siteCount < 2) continue;
                if ((conn.from === 'lobbyB' || conn.to === 'lobbyB') && siteCount < 2) continue;
                
                // 색상 결정
                let color = '#ffffff55';
                if (conn.from === 'atk' || conn.to === 'atk') color = '#e74c3c66';
                else if (conn.from === 'def' || conn.to === 'def') color = '#3498db66';
                else if (conn.from === 'mid' || conn.to === 'mid') color = '#9b59b666';
                else if (conn.from.includes('lobby') || conn.to.includes('lobby')) color = '#e67e2266';
                else if (conn.from.includes('side') || conn.to.includes('side')) color = '#1abc9c66';
                
                this.drawConnection(ctx, p1, p2, color);
                
                // X 버튼 (선 중앙)
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                
                // 버튼 위치 저장
                this.connectionButtons.push({ x: midX, y: midY, index: i });
                
                // X 버튼 배경
                ctx.setLineDash([]);
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(midX, midY, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // X 텍스트
                ctx.fillStyle = '#ff6b6b';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('×', midX, midY);
                
                ctx.setLineDash([5, 5]);
            }
        }
        
        ctx.setLineDash([]);
        
        // 포인트 그리기 (작은 것부터)
        const hovered = this.previewHoveredNode;
        
        // 랑데뷰 포인트 (토글 확인)
        if (siteCount >= 1 && enableSideA) this.drawPoint(ctx, pts.sideA, hovered === 'sideA');
        if (siteCount >= 1 && enableLobbyA) this.drawPoint(ctx, pts.lobbyA, hovered === 'lobbyA');
        if (siteCount >= 2 && enableSideB) this.drawPoint(ctx, pts.sideB, hovered === 'sideB');
        if (siteCount >= 2 && enableLobbyB) this.drawPoint(ctx, pts.lobbyB, hovered === 'lobbyB');
        
        // 미드
        this.drawPoint(ctx, pts.mid, hovered === 'mid');
        
        // 사이트
        if (siteCount >= 1) this.drawPoint(ctx, pts.siteA, hovered === 'siteA');
        if (siteCount >= 2) this.drawPoint(ctx, pts.siteB, hovered === 'siteB');
        if (siteCount >= 3) this.drawPoint(ctx, pts.siteC, hovered === 'siteC');
        
        // 스폰
        this.drawPoint(ctx, pts.atk, hovered === 'atk');
        this.drawPoint(ctx, pts.def, hovered === 'def');
        
        // 거리 정보 표시
        this.drawDistanceInfo(ctx, pts, siteCount);
    }
    
    drawConnection(ctx, p1, p2, color) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
    
    drawPoint(ctx, pt, isHovered = false) {
        const size = isHovered ? pt.size + 3 : pt.size;
        
        // 호버 시 외곽 글로우 강조
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, size + (isHovered ? 8 : 4), 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? pt.color + '66' : pt.color + '33';
        ctx.fill();
        
        // 호버 시 추가 링
        if (isHovered) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, size + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // 메인 원
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#fff' : '#ffffff99';
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();
        
        // 라벨
        ctx.fillStyle = '#fff';
        ctx.font = isHovered ? 'bold 12px sans-serif' : 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pt.label, pt.x, pt.y);
    }
    
    drawDistanceInfo(ctx, pts, siteCount) {
        const canvas = document.getElementById('previewCanvas');
        const w = canvas?.width || 460;
        const h = canvas?.height || 520;
        const scale = 0.4; // 픽셀 → 미터 (대략)
        
        // 토글 상태
        const enableSideA = document.getElementById('enableSideA')?.checked ?? true;
        const enableSideB = document.getElementById('enableSideB')?.checked ?? true;
        const enableLobbyA = document.getElementById('enableLobbyA')?.checked ?? true;
        const enableLobbyB = document.getElementById('enableLobbyB')?.checked ?? true;
        
        // === 거리 정보 패널 ===
        ctx.fillStyle = '#00000088';
        ctx.fillRect(5, h - 85, 130, 80);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(5, h - 85, 130, 80);
        
        ctx.fillStyle = '#4ecdc4';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('거리 정보', 10, h - 73);
        
        ctx.fillStyle = '#aaa';
        ctx.font = '9px sans-serif';
        let y = h - 58;
        
        if (siteCount >= 1) {
            const distA = Math.sqrt((pts.atk.x - pts.siteA.x) ** 2 + (pts.atk.y - pts.siteA.y) ** 2) * scale;
            const defDistA = Math.sqrt((pts.def.x - pts.siteA.x) ** 2 + (pts.def.y - pts.siteA.y) ** 2) * scale;
            ctx.fillText(`ATK→A: ${distA.toFixed(0)}m`, 10, y); y += 11;
            ctx.fillText(`DEF→A: ${defDistA.toFixed(0)}m`, 10, y); y += 11;
        }
        
        if (siteCount >= 2) {
            const distB = Math.sqrt((pts.atk.x - pts.siteB.x) ** 2 + (pts.atk.y - pts.siteB.y) ** 2) * scale;
            const defDistB = Math.sqrt((pts.def.x - pts.siteB.x) ** 2 + (pts.def.y - pts.siteB.y) ** 2) * scale;
            ctx.fillText(`ATK→B: ${distB.toFixed(0)}m`, 10, y); y += 11;
            ctx.fillText(`DEF→B: ${defDistB.toFixed(0)}m`, 10, y); y += 11;
        }
        
        // MID 거리
        const midDist = Math.sqrt((pts.atk.x - pts.mid.x) ** 2 + (pts.atk.y - pts.mid.y) ** 2) * scale;
        ctx.fillText(`ATK→MID: ${midDist.toFixed(0)}m`, 10, y);
        
        // === 룸 사이즈 패널 ===
        const siteSizeMin = parseInt(document.getElementById('siteSizeMin')?.value || 18);
        const siteSizeMax = parseInt(document.getElementById('siteSizeMax')?.value || 26);
        const roomSizeMin = parseInt(document.getElementById('roomSizeMin')?.value || 14);
        const roomSizeMax = parseInt(document.getElementById('roomSizeMax')?.value || 22);
        
        ctx.fillStyle = '#00000088';
        ctx.fillRect(w - 135, h - 70, 130, 65);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(w - 135, h - 70, 130, 65);
        
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('예상 룸 사이즈', w - 130, h - 58);
        
        ctx.fillStyle = '#aaa';
        ctx.font = '9px sans-serif';
        ctx.fillText(`SITE: ${siteSizeMin}~${siteSizeMax}m`, w - 130, h - 44);
        ctx.fillText(`MID/LOBBY: ${roomSizeMin}~${roomSizeMax}m`, w - 130, h - 32);
        ctx.fillText(`SIDE: ${Math.max(8,roomSizeMin-4)}~${Math.max(12,roomSizeMax-4)}m`, w - 130, h - 20);
    }
    
    // 룸 사이즈 미리보기 그리기 (포인트 뒤에)
    drawRoomPreview(ctx, pt, sizeM, color) {
        const scale = 2.5; // 미터 → 픽셀 (프리뷰용)
        const sizePx = sizeM * scale;
        const half = sizePx / 2;
        
        ctx.fillStyle = color + '15';
        ctx.strokeStyle = color + '40';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath();
        ctx.rect(pt.x - half, pt.y - half, sizePx, sizePx);
        ctx.fill();
        ctx.stroke();
        
        ctx.setLineDash([]);
    }
    
    onPreviewMouseDown(e) {
        const canvas = document.getElementById('previewCanvas');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const siteCount = parseInt(document.querySelector('input[name="siteCount"]:checked')?.value || '2');
        
        // 어떤 포인트를 클릭했는지 확인
        for (const [key, pt] of Object.entries(this.previewPoints)) {
            // 사이트 개수에 따라 비활성 포인트 제외
            if (key === 'siteC' && siteCount < 3) continue;
            if (key === 'siteB' && siteCount < 2) continue;
            if (!this.isNodeEnabled(key)) continue;
            
            const dist = Math.sqrt((x - pt.x) ** 2 + (y - pt.y) ** 2);
            if (dist < pt.size + 5) {
                if (e.shiftKey) {
                    // Shift+드래그: 연결 모드
                    this.previewConnecting = key;
                    canvas.style.cursor = 'crosshair';
                } else {
                    // 일반 드래그: 이동 모드
                    this.previewDragging = key;
                    canvas.style.cursor = 'grabbing';
                }
                return;
            }
        }
    }
    
    // 노드가 활성화되어 있는지 확인
    isNodeEnabled(key) {
        if (key === 'sideA') return document.getElementById('enableSideA')?.checked ?? true;
        if (key === 'sideB') return document.getElementById('enableSideB')?.checked ?? true;
        if (key === 'lobbyA') return document.getElementById('enableLobbyA')?.checked ?? true;
        if (key === 'lobbyB') return document.getElementById('enableLobbyB')?.checked ?? true;
        return true;
    }
    
    // X 버튼 클릭 (연결선 삭제)
    onPreviewClick(e) {
        if (this.previewDragging || this.previewConnecting) return;
        if (!this.connectionButtons) return;
        
        const canvas = document.getElementById('previewCanvas');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // X 버튼 클릭 확인
        for (const btn of this.connectionButtons) {
            const dist = Math.sqrt((x - btn.x) ** 2 + (y - btn.y) ** 2);
            if (dist < 12) {
                // 연결선 삭제
                this.previewConnections.splice(btn.index, 1);
                this.renderPreview();
                return;
            }
        }
    }
    
    onPreviewMouseMove(e) {
        const canvas = document.getElementById('previewCanvas');
        const rect = canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const x = Math.max(20, Math.min(canvas.width - 20, rawX));
        const y = Math.max(20, Math.min(canvas.height - 20, rawY));
        
        if (this.previewDragging) {
            // 노드 이동
            this.previewPoints[this.previewDragging].x = x;
            this.previewPoints[this.previewDragging].y = y;
            canvas.style.cursor = 'grabbing';
            this.renderPreview();
            this.updateParamsFromPreview();
        } else if (this.previewConnecting) {
            // 연결 중 - 선 미리보기
            this.renderPreview();
            const ctx = canvas.getContext('2d');
            const startPt = this.previewPoints[this.previewConnecting];
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(startPt.x, startPt.y);
            ctx.lineTo(rawX, rawY);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // 호버 체크
            const siteCount = parseInt(document.querySelector('input[name="siteCount"]:checked')?.value || '2');
            let hoveredNode = null;
            
            for (const [key, pt] of Object.entries(this.previewPoints)) {
                if (key === 'siteC' && siteCount < 3) continue;
                if (key === 'siteB' && siteCount < 2) continue;
                if (!this.isNodeEnabled(key)) continue;
                
                const dist = Math.sqrt((rawX - pt.x) ** 2 + (rawY - pt.y) ** 2);
                if (dist < pt.size + 5) {
                    hoveredNode = key;
                    break;
                }
            }
            
            if (hoveredNode !== this.previewHoveredNode) {
                this.previewHoveredNode = hoveredNode;
                canvas.style.cursor = hoveredNode ? 'pointer' : 'crosshair';
                this.renderPreview();
            }
        }
    }
    
    onPreviewMouseUp(e) {
        const canvas = document.getElementById('previewCanvas');
        
        if (this.previewConnecting && e) {
            // 연결 완료 - 대상 노드 찾기
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const siteCount = parseInt(document.querySelector('input[name="siteCount"]:checked')?.value || '2');
            
            for (const [key, pt] of Object.entries(this.previewPoints)) {
                if (key === this.previewConnecting) continue;
                if (key === 'siteC' && siteCount < 3) continue;
                if (key === 'siteB' && siteCount < 2) continue;
                if (!this.isNodeEnabled(key)) continue;
                
                const dist = Math.sqrt((x - pt.x) ** 2 + (y - pt.y) ** 2);
                if (dist < pt.size + 10) {
                    // 연결 추가 (중복 체크)
                    this.addConnection(this.previewConnecting, key);
                    break;
                }
            }
        }
        
        this.previewDragging = null;
        this.previewConnecting = null;
        if (canvas) canvas.style.cursor = 'crosshair';
        this.renderPreview();
    }
    
    // 연결 추가
    addConnection(from, to) {
        if (!this.previewConnections) this.previewConnections = [];
        
        // 중복 체크 (방향 무관)
        const exists = this.previewConnections.some(c => 
            (c.from === from && c.to === to) || (c.from === to && c.to === from)
        );
        
        if (!exists) {
            this.previewConnections.push({ from, to });
        }
    }
    
    // 연결 초기화
    resetConnections() {
        this.previewConnections = [
            { from: 'atk', to: 'mid' },
            { from: 'atk', to: 'lobbyA' },
            { from: 'atk', to: 'lobbyB' },
            { from: 'lobbyA', to: 'siteA' },
            { from: 'lobbyB', to: 'siteB' },
            { from: 'mid', to: 'sideA' },
            { from: 'mid', to: 'sideB' },
            { from: 'sideA', to: 'siteA' },
            { from: 'sideB', to: 'siteB' },
            { from: 'def', to: 'siteA' },
            { from: 'def', to: 'siteB' },
        ];
        this.renderPreview();
    }
    
    updateParamsFromPreview() {
        if (!this.previewPoints) return;
        
        const pts = this.previewPoints;
        const scale = 0.4; // 픽셀 → 미터
        const siteCount = parseInt(document.querySelector('input[name="siteCount"]:checked')?.value || '2');
        
        // ATK → Site 거리 계산
        let minAtkDist = Infinity, maxAtkDist = 0;
        if (siteCount >= 1) {
            const d = Math.sqrt((pts.atk.x - pts.siteA.x) ** 2 + (pts.atk.y - pts.siteA.y) ** 2) * scale;
            minAtkDist = Math.min(minAtkDist, d);
            maxAtkDist = Math.max(maxAtkDist, d);
        }
        if (siteCount >= 2) {
            const d = Math.sqrt((pts.atk.x - pts.siteB.x) ** 2 + (pts.atk.y - pts.siteB.y) ** 2) * scale;
            minAtkDist = Math.min(minAtkDist, d);
            maxAtkDist = Math.max(maxAtkDist, d);
        }
        
        // DEF → Site 거리 계산
        let minDefDist = Infinity, maxDefDist = 0;
        if (siteCount >= 1) {
            const d = Math.sqrt((pts.def.x - pts.siteA.x) ** 2 + (pts.def.y - pts.siteA.y) ** 2) * scale;
            minDefDist = Math.min(minDefDist, d);
            maxDefDist = Math.max(maxDefDist, d);
        }
        if (siteCount >= 2) {
            const d = Math.sqrt((pts.def.x - pts.siteB.x) ** 2 + (pts.def.y - pts.siteB.y) ** 2) * scale;
            minDefDist = Math.min(minDefDist, d);
            maxDefDist = Math.max(maxDefDist, d);
        }
        
        // 입력 필드 업데이트
        const atkMinEl = document.getElementById('atkToSiteMin');
        const atkMaxEl = document.getElementById('atkToSiteMax');
        const defMinEl = document.getElementById('defToSiteMin');
        const defMaxEl = document.getElementById('defToSiteMax');
        
        if (atkMinEl && minAtkDist < Infinity) atkMinEl.value = Math.round(minAtkDist);
        if (atkMaxEl && maxAtkDist > 0) atkMaxEl.value = Math.round(maxAtkDist);
        if (defMinEl && minDefDist < Infinity) defMinEl.value = Math.round(minDefDist);
        if (defMaxEl && maxDefDist > 0) defMaxEl.value = Math.round(maxDefDist);
    }
    
    randomizePreview() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;
        
        const w = canvas.width;
        const h = canvas.height;
        const margin = 40;
        
        // 랜덤 위치 (약간의 제약)
        this.previewPoints.atk.x = w / 2 + (Math.random() - 0.5) * 100;
        this.previewPoints.atk.y = h - margin - Math.random() * 30;
        
        this.previewPoints.def.x = w / 2 + (Math.random() - 0.5) * 100;
        this.previewPoints.def.y = margin + Math.random() * 30;
        
        this.previewPoints.mid.x = w / 2 + (Math.random() - 0.5) * 80;
        this.previewPoints.mid.y = h / 2 + (Math.random() - 0.5) * 60;
        
        this.previewPoints.siteA.x = margin + Math.random() * (w / 3);
        this.previewPoints.siteA.y = margin + Math.random() * (h / 3);
        
        this.previewPoints.siteB.x = w - margin - Math.random() * (w / 3);
        this.previewPoints.siteB.y = margin + Math.random() * (h / 3);
        
        this.previewPoints.siteC.x = w / 2 + (Math.random() - 0.5) * 100;
        this.previewPoints.siteC.y = margin + Math.random() * 60;
        
        this.renderPreview();
        this.updateParamsFromPreview();
    }
    
    resetPreview() {
        const canvas = document.getElementById('previewCanvas');
        if (!canvas) return;
        
        const w = canvas.width;
        const h = canvas.height;
        
        this.previewPoints = {
            // 스폰
            atk: { x: w / 2, y: h - 50, color: '#e74c3c', label: 'ATK', size: 20 },
            def: { x: w / 2, y: 50, color: '#3498db', label: 'DEF', size: 20 },
            // 사이트
            siteA: { x: w / 5, y: h / 5, color: '#f1c40f', label: 'A', size: 22 },
            siteB: { x: 4 * w / 5, y: h / 5, color: '#f1c40f', label: 'B', size: 22 },
            siteC: { x: w / 2, y: h / 7, color: '#f1c40f', label: 'C', size: 22 },
            // 미드
            mid: { x: w / 2, y: h / 2, color: '#9b59b6', label: 'MID', size: 16 },
            // 랑데뷰 포인트 (SIDE - 플랭크)
            sideA: { x: w / 6, y: h * 0.4, color: '#1abc9c', label: 'A側', size: 14 },
            sideB: { x: 5 * w / 6, y: h * 0.4, color: '#1abc9c', label: 'B側', size: 14 },
            // 로비 (진입 전 대기)
            lobbyA: { x: w / 4, y: h * 0.6, color: '#e67e22', label: 'A入', size: 14 },
            lobbyB: { x: 3 * w / 4, y: h * 0.6, color: '#e67e22', label: 'B入', size: 14 },
        };
        
        this.renderPreview();
        this.updateParamsFromPreview();
    }
    
    applyPreset(preset) {
        const presets = {
            compact: {
                atkToSiteMin: 40, atkToSiteMax: 60,
                defToSiteMin: 30, defToSiteMax: 50,
                maxStraight: 15, corridorWidthMin: 4, corridorWidthMax: 5,
                maxSightline: 35, coverSpacingMin: 6, coverSpacingMax: 10, exposedMax: 8
            },
            standard: {
                atkToSiteMin: 60, atkToSiteMax: 90,
                defToSiteMin: 40, defToSiteMax: 70,
                maxStraight: 25, corridorWidthMin: 4, corridorWidthMax: 7,
                maxSightline: 50, coverSpacingMin: 8, coverSpacingMax: 15, exposedMax: 12
            },
            open: {
                atkToSiteMin: 80, atkToSiteMax: 120,
                defToSiteMin: 50, defToSiteMax: 90,
                maxStraight: 35, corridorWidthMin: 6, corridorWidthMax: 9,
                maxSightline: 70, coverSpacingMin: 10, coverSpacingMax: 18, exposedMax: 16
            }
        };
        
        const p = presets[preset];
        if (!p) return;
        
        document.getElementById('atkToSiteMin').value = p.atkToSiteMin;
        document.getElementById('atkToSiteMax').value = p.atkToSiteMax;
        document.getElementById('defToSiteMin').value = p.defToSiteMin;
        document.getElementById('defToSiteMax').value = p.defToSiteMax;
        document.getElementById('maxStraight').value = p.maxStraight;
        document.getElementById('maxStraightVal').textContent = p.maxStraight + 'm';
        document.getElementById('corridorWidthMin').value = p.corridorWidthMin;
        document.getElementById('corridorWidthMax').value = p.corridorWidthMax;
        document.getElementById('maxSightline').value = p.maxSightline;
        document.getElementById('maxSightlineVal').textContent = p.maxSightline + 'm';
        document.getElementById('coverSpacingMin').value = p.coverSpacingMin;
        document.getElementById('coverSpacingMax').value = p.coverSpacingMax;
        document.getElementById('exposedMax').value = p.exposedMax;
        document.getElementById('exposedMaxVal').textContent = p.exposedMax + 'm';
        
        this.showToast(`${preset} 프리셋 적용됨`);
    }
    
    // 새 시드로 재생성 (이전 설정 사용)
    async regenerateMap() {
        if (!this.lastGenerateOptions) {
            this.showToast('먼저 맵을 생성해주세요');
            return;
        }
        
        const PYTHON_API = 'http://localhost:3003';
        
        // 새 시드 적용
        this.lastGenerateOptions.options.seed = Math.floor(Math.random() * 1000000);
        
        // 캔버스 비우기
        this.objects = [];
        this.nextId = 1;
        
        this.showToast(`재생성 중... (Seed: ${this.lastGenerateOptions.options.seed})`);
        
        try {
            const response = await fetch(`${PYTHON_API}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.lastGenerateOptions)
            });
            
            if (!response.ok) throw new Error('API 오류');
            
            const data = await response.json();
            
            if (data.objects && data.objects.length > 0) {
                data.objects.forEach(obj => {
                    obj.id = this.nextId++;
                    this.objects.push(obj);
                });
                
                this.render();
                this.showToast(`${data.objects.length}개 오브젝트 (Seed: ${data.seed})`);
            }
        } catch (e) {
            console.error('재생성 실패:', e);
            this.showToast('재생성 실패: ' + e.message, 'error');
        }
    }
    
    async generateWithParams() {
        const PYTHON_API = 'http://localhost:3003';
        
        // 파라미터 수집
        const rules = {
            sizes: {
                site: [
                    parseInt(document.getElementById('siteSizeMin').value),
                    parseInt(document.getElementById('siteSizeMax').value)
                ],
                room: [
                    parseInt(document.getElementById('roomSizeMin').value),
                    parseInt(document.getElementById('roomSizeMax').value)
                ]
            },
            timing: {
                atk_to_site: [
                    parseInt(document.getElementById('atkToSiteMin').value),
                    parseInt(document.getElementById('atkToSiteMax').value)
                ],
                def_to_site: [
                    parseInt(document.getElementById('defToSiteMin').value),
                    parseInt(document.getElementById('defToSiteMax').value)
                ]
            },
            corridors: {
                max_straight: parseInt(document.getElementById('maxStraight').value),
                width: [
                    parseInt(document.getElementById('corridorWidthMin').value),
                    parseInt(document.getElementById('corridorWidthMax').value)
                ]
            },
            sightlines: {
                max_length: parseInt(document.getElementById('maxSightline').value)
            },
            cover: {
                spacing: [
                    parseInt(document.getElementById('coverSpacingMin').value),
                    parseInt(document.getElementById('coverSpacingMax').value)
                ],
                exposed_max: parseInt(document.getElementById('exposedMax').value)
            }
        };
        
        // 캔버스 비우기 옵션
        const clearCanvas = document.getElementById('clearCanvas').checked;
        if (clearCanvas) {
            this.objects = [];
            this.nextId = 1;
        }
        
        // 알고리즘 선택
        const algorithm = document.querySelector('input[name="algorithm"]:checked')?.value || 'v2';
        
        // 사이트 개수
        const siteCount = parseInt(document.querySelector('input[name="siteCount"]:checked')?.value || '2');
        
        // 프리뷰 레이아웃 정보 (노드 위치를 정규화해서 전달)
        let layout = null;
        if (this.previewPoints) {
            const canvas = document.getElementById('previewCanvas');
            const w = canvas?.width || 360;
            const h = canvas?.height || 400;
            
            // 0~1 범위로 정규화
            layout = {
                atk: { x: this.previewPoints.atk.x / w, y: this.previewPoints.atk.y / h },
                def: { x: this.previewPoints.def.x / w, y: this.previewPoints.def.y / h },
                mid: { x: this.previewPoints.mid.x / w, y: this.previewPoints.mid.y / h },
                siteA: { x: this.previewPoints.siteA.x / w, y: this.previewPoints.siteA.y / h },
                siteB: { x: this.previewPoints.siteB.x / w, y: this.previewPoints.siteB.y / h },
                siteC: { x: this.previewPoints.siteC.x / w, y: this.previewPoints.siteC.y / h },
            };
            
            // 랑데뷰 포인트 (토글된 것만)
            if (document.getElementById('enableSideA')?.checked) {
                layout.sideA = { x: this.previewPoints.sideA.x / w, y: this.previewPoints.sideA.y / h };
            }
            if (document.getElementById('enableSideB')?.checked) {
                layout.sideB = { x: this.previewPoints.sideB.x / w, y: this.previewPoints.sideB.y / h };
            }
            if (document.getElementById('enableLobbyA')?.checked) {
                layout.lobbyA = { x: this.previewPoints.lobbyA.x / w, y: this.previewPoints.lobbyA.y / h };
            }
            if (document.getElementById('enableLobbyB')?.checked) {
                layout.lobbyB = { x: this.previewPoints.lobbyB.x / w, y: this.previewPoints.lobbyB.y / h };
            }
        }
        
        // 모달 닫기
        this.closeProceduralDialog();
        
        // 기본 영역
        const bounds = { x: -2400, y: -2400, width: 4800, height: 4800 };
        
        this.showToast(`맵 생성 중... (${algorithm === 'v3' ? '유기적' : '그리드형'})`);
        
        try {
            // 설정 저장 (재생성용)
            this.lastGenerateOptions = {
                bounds: bounds,
                options: {
                    seed: Math.floor(Math.random() * 1000000),
                    rules: rules,
                    algorithm: algorithm,
                    site_count: siteCount,
                    layout: layout,
                    walls: {
                        perimeter: document.getElementById('enablePerimeterWalls')?.checked ?? true,
                        gaps: document.getElementById('enableGapWalls')?.checked ?? true
                    }
                }
            };
            
            const response = await fetch(`${PYTHON_API}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.lastGenerateOptions)
            });
            
            if (!response.ok) throw new Error('API 오류');
            
            const data = await response.json();
            
            if (data.objects && data.objects.length > 0) {
                data.objects.forEach(obj => {
                    obj.id = this.nextId++;
                    this.objects.push(obj);
                });
                
                this.render();
                this.showToast(`${data.objects.length}개 오브젝트 생성됨 (Seed: ${data.seed})`);
                this.updateAIStatus(`생성 완료`, 'success');
            } else {
                this.showToast('생성된 오브젝트가 없습니다');
            }
        } catch (err) {
            console.error('Python API 오류:', err);
            this.showToast('Python 서버 연결 실패');
            this.updateAIStatus('Python 서버 없음', 'error');
        }
    }
    
    async proceduralGenerate(style = 'standard') {
        const PYTHON_API = 'http://localhost:3003';
        
        // 선택된 영역이 있으면 그 영역 사용, 없으면 전체 영역
        let bounds;
        const selectedObj = this.objects.find(o => this.isSelected(o.id));
        
        if (selectedObj && selectedObj.width && selectedObj.height) {
            bounds = {
                x: selectedObj.x,
                y: selectedObj.y,
                width: selectedObj.width,
                height: selectedObj.height
            };
            this.showToast(`선택 영역에서 생성 중... (${style})`);
        } else {
            // 전체 영역 계산
            const allFloors = this.objects.filter(o => 
                o.type === 'polyfloor' || o.type === 'floor-area' ||
                o.type === 'spawn-def' || o.type === 'spawn-off' || o.type === 'objective'
            );
            
            if (allFloors.length > 0) {
                const xs = allFloors.flatMap(o => o.points ? o.points.map(p => p.x) : [o.x, o.x + o.width]);
                const ys = allFloors.flatMap(o => o.points ? o.points.map(p => p.y) : [o.y, o.y + o.height]);
                bounds = {
                    x: Math.min(...xs) - 200,
                    y: Math.min(...ys) - 200,
                    width: Math.max(...xs) - Math.min(...xs) + 400,
                    height: Math.max(...ys) - Math.min(...ys) + 400
                };
            } else {
                // 기본 영역
                bounds = { x: -1500, y: -1500, width: 3000, height: 3000 };
            }
            this.showToast(`새 맵 생성 중... (${style})`);
        }
        
        try {
            const response = await fetch(`${PYTHON_API}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bounds: bounds,
                    options: {
                        style: style,
                        complexity: 3,
                        seed: Math.floor(Math.random() * 1000000)
                    }
                })
            });
            
            if (!response.ok) throw new Error('API 오류');
            
            const data = await response.json();
            
            if (data.objects && data.objects.length > 0) {
                // ID 할당 및 추가
                data.objects.forEach(obj => {
                    obj.id = this.nextId++;
                    this.objects.push(obj);
                });
                
                this.render();
                this.showToast(`✅ ${data.objects.length}개 오브젝트 생성됨 (Seed: ${data.seed})`);
                this.updateAIStatus(`생성 완료: ${style}`, 'success');
            } else {
                this.showToast('생성된 오브젝트가 없습니다');
            }
        } catch (err) {
            console.error('Python API 오류:', err);
            this.showToast('⚠️ Python 서버 연결 실패. procedural_api_server.py 실행 필요');
            this.updateAIStatus('Python 서버 없음', 'error');
        }
    }
    
    // 브러시 영역에서 생성 (선택 영역 필수)
    async proceduralFromSelection(style = 'standard') {
        const selectedObj = this.objects.find(o => this.isSelected(o.id));
        
        if (!selectedObj) {
            this.showToast('먼저 영역을 선택하세요 (floor-area 또는 polyfloor)');
            return;
        }
        
        await this.proceduralGenerate(style);
    }
    
    async aiAutoGenerate(mode) {
        // 기존 바닥 edge 분석
        const disconnectedPairs = this.findDisconnectedEdgePairs();
        const edges = this.analyzeFloorEdges();
        
        // 정확한 좌표 정보 제공
        const edgeInfo = disconnectedPairs.map((pair, i) => 
            `연결${i+1}: "${pair.edge1.floorLabel}" edge(${pair.edge1.p1.x},${pair.edge1.p1.y})-(${pair.edge1.p2.x},${pair.edge1.p2.y}) ↔ "${pair.edge2.floorLabel}" edge(${pair.edge2.p1.x},${pair.edge2.p1.y})-(${pair.edge2.p2.x},${pair.edge2.p2.y}), 거리:${pair.distance}m`
        ).join('\n');
        
        const prompt = mode === 'connect' 
            ? `다음 edge들을 연결하는 직사각형 통로를 생성해줘.

연결할 edge 쌍들:
${edgeInfo || '연결 가능한 edge가 없습니다. 기존 바닥 근처에 새 통로를 만들어주세요.'}

규칙:
1. 통로는 반드시 edge의 좌표와 정확히 맞닿아야 함
2. 통로 폭: 128~192px (4~6m)
3. 직선 또는 L자형 통로만 사용
4. points 배열은 시계방향으로 4~6개 점`
            : mode === 'expand'
            ? `기존 바닥 주변에 새로운 영역을 확장해줘.

기존 edge 정보:
${edges.slice(0, 10).map(e => `${e.floorLabel}: (${e.p1.x},${e.p1.y})-(${e.p2.x},${e.p2.y}), ${e.length}m, ${e.direction}`).join('\n')}

규칙:
1. 기존 edge에 정확히 연결
2. 다양한 전투 공간 생성 (8x8m ~ 15x15m)
3. 3초 룰 고려 (15m마다 방향 전환 가능)`
            : `Offence에서 Objective로 가는 측면 우회 경로를 만들어줘.`;
        
        this.updateAIStatus('🤖 Edge 분석 완료, 생성 중...', 'loading');
        
        try {
            const response = await fetch('http://localhost:3001/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    levelData: {
                        levelName: this.levelName,
                        objects: this.objects,
                        gridSize: this.gridSize
                    }
                })
            });
            
            if (!response.ok) throw new Error('AI 서버 오류');
            
            const data = await response.json();
            const parsed = this.parseAIResponseRaw(data.response);
            
            if (parsed?.objects?.length > 0) {
                // 좌표 스냅 처리 (기존 점에 맞추기)
                const snappedObjects = this.snapAIObjectsToEdges(parsed.objects);
                
                this.aiPendingObjects = snappedObjects.map(obj => ({
                    ...obj,
                    id: this.nextId++,
                    floor: this.currentFloor,
                    category: 'floors',
                    color: 'hsla(180, 60%, 45%, 0.6)',
                    closed: true,
                    floorHeight: obj.floorHeight ?? 0
                }));
                
                this.aiSelectedIndices = new Set(this.aiPendingObjects.map((_, i) => i));
                this.addAIActionButtons(`${this.aiPendingObjects.length}개 통로 생성`);
                this.updateAIStatus(`✅ ${this.aiPendingObjects.length}개 생성 완료`, 'success');
                this.render();
            } else {
                this.updateAIStatus('❌ 생성 실패', 'error');
            }
            
        } catch (err) {
            this.updateAIStatus('❌ AI 서버 오류', 'error');
            console.error(err);
        }
    }
    
    // AI 생성 오브젝트를 기존 edge에 스냅
    snapAIObjectsToEdges(objects) {
        const existingPoints = [];
        this.objects.forEach(obj => {
            if (obj.points) {
                obj.points.forEach(p => existingPoints.push({ x: p.x, y: p.y }));
            }
        });
        
        return objects.map(obj => {
            if (!obj.points) return obj;
            
            const snappedPoints = obj.points.map(p => {
                // 가장 가까운 기존 점 찾기 (64px = 2m 이내)
                let closest = null;
                let minDist = 64;
                
                existingPoints.forEach(ep => {
                    const dist = Math.sqrt((p.x - ep.x) ** 2 + (p.y - ep.y) ** 2);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = ep;
                    }
                });
                
                return closest ? { x: closest.x, y: closest.y, z: p.z || 0 } : p;
            });
            
            return { ...obj, points: snappedPoints };
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // JSON만 파싱 (UI 없이)
    parseAIResponseRaw(response) {
        let cleaned = response.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        
        try {
            return JSON.parse(cleaned);
        } catch (e) {}
        
        // { } 추출
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
                        return JSON.parse(cleaned.substring(start, end));
                    } catch (e) {}
                    start = -1;
                }
            }
        }
        
        return null;
    }
    
    async sendAIMessage() {
        const input = document.getElementById('aiInput');
        const messages = document.getElementById('aiMessages');
        const prompt = input?.value?.trim();
        
        if (!prompt) return;
        
        // 재시도를 위해 저장
        this.lastAIPrompt = prompt;
        
        // 사용자 메시지 추가
        this.addAIMessage(prompt, 'user');
        input.value = '';
        
        this.updateAIStatus('🤖 생각 중...', 'loading');
        
        // 로딩 메시지
        const loadingMsg = this.addAIMessage('생각 중...', 'loading');
        
        try {
            const response = await fetch('http://localhost:3001/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    levelData: {
                        levelName: this.levelName,
                        objects: this.objects,
                        gridSize: this.gridSize
                    }
                })
            });
            
            loadingMsg.remove();
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'AI 서버 오류');
            }
            
            const data = await response.json();
            this.addAIMessage(data.response, 'assistant');
            
            // JSON 응답이 포함되어 있으면 파싱하여 오브젝트 추가 제안
            this.parseAIResponse(data.response);
            
        } catch (err) {
            loadingMsg?.remove();
            if (err.message.includes('fetch')) {
                this.addAIMessage('AI 서버에 연결할 수 없습니다.\n\n터미널에서 실행:\nnode ai-server.js', 'error');
            } else {
                this.addAIMessage(`오류: ${err.message}`, 'error');
            }
        }
    }
    
    addAIMessage(text, type) {
        const messages = document.getElementById('aiMessages');
        if (!messages) return null;
        
        const msg = document.createElement('div');
        msg.className = `ai-message ${type}`;
        msg.textContent = text;
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        
        return msg;
    }
    
    parseAIResponse(response, retryCount = 0) {
        let jsonData = null;
        let parseError = null;
        
        // 전처리: 코드블록 마커 제거
        let cleaned = response
            .replace(/```json\n?/gi, '')
            .replace(/```\n?/g, '')
            .trim();
        
        // 1. 직접 파싱 시도
        try {
            jsonData = JSON.parse(cleaned);
        } catch (e) {
            parseError = e;
        }
        
        // 2. { ... } 추출 후 파싱
        if (!jsonData) {
            // 중첩된 {} 처리를 위한 간단한 매칭
            let depth = 0;
            let start = -1;
            let end = -1;
            for (let i = 0; i < cleaned.length; i++) {
                if (cleaned[i] === '{') {
                    if (depth === 0) start = i;
                    depth++;
                } else if (cleaned[i] === '}') {
                    depth--;
                    if (depth === 0) {
                        end = i + 1;
                        break;
                    }
                }
            }
            if (start >= 0 && end > start) {
                try {
                    jsonData = JSON.parse(cleaned.substring(start, end));
                } catch (e) {
                    parseError = e;
                }
            }
        }
        
        // 3. objects 배열 직접 추출
        if (!jsonData || !jsonData.objects) {
            const arrMatch = cleaned.match(/"objects"\s*:\s*(\[[\s\S]*?\])/);
            if (arrMatch) {
                try {
                    const arr = JSON.parse(arrMatch[1]);
                    if (Array.isArray(arr)) {
                        jsonData = { objects: arr };
                    }
                } catch (e) {
                    parseError = e;
                }
            }
        }
        
        console.log('AI 응답 파싱:', jsonData ? `${jsonData.objects?.length || 0}개 오브젝트` : '실패');
        
        // 파싱 성공
        if (jsonData && jsonData.objects && Array.isArray(jsonData.objects) && jsonData.objects.length > 0) {
            // AI 생성 오브젝트 미리보기 추가
            this.aiPendingObjects = jsonData.objects.map(obj => ({
                ...obj,
                id: this.nextId++,
                floor: obj.floor ?? this.currentFloor,
                category: obj.category || 'floors',
                color: obj.color || 'hsla(280, 60%, 50%, 0.6)',
                closed: obj.closed ?? true,
                floorHeight: obj.floorHeight ?? 0
            }));
            
            // 미리보기 렌더링
            this.showAIPreview();
            
            // 성공 메시지 + 확인 버튼
            const desc = jsonData.description || `${jsonData.objects.length}개 오브젝트`;
            this.addAIActionButtons(desc);
            this.addAIStatusMessage('success', `✅ OK - ${jsonData.objects.length}개 오브젝트 파싱 성공`);
            return true;
        }
        
        // 파싱 실패 - 재시도 (최대 1회)
        if (parseError && retryCount < 1) {
            console.warn('AI JSON 파싱 실패, 재시도 중...', parseError);
            this.addAIStatusMessage('warning', '⚠️ 파싱 실패, 재시도 중...');
            
            // 마지막 프롬프트로 재시도
            if (this.lastAIPrompt) {
                setTimeout(() => {
                    this.retryAIRequest(retryCount + 1);
                }, 1000);
            }
            return false;
        }
        
        // 최종 실패
        if (parseError) {
            this.addAIStatusMessage('error', '❌ JSON 파싱 실패 - 다시 시도해주세요');
            console.error('AI JSON 파싱 최종 실패:', parseError);
        }
        
        return false;
    }
    
    addAIStatusMessage(type, text) {
        const messages = document.getElementById('aiMessages');
        if (!messages) return;
        
        const status = document.createElement('div');
        status.className = `ai-status ai-status-${type}`;
        status.textContent = text;
        messages.appendChild(status);
        messages.scrollTop = messages.scrollHeight;
        
        // 성공/경고는 3초 후 자동 제거
        if (type !== 'error') {
            setTimeout(() => status.remove(), 3000);
        }
    }
    
    async retryAIRequest(retryCount) {
        if (!this.lastAIPrompt) return;
        
        try {
            const response = await fetch('http://localhost:3001/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: this.lastAIPrompt + '\n\n(이전 응답이 파싱에 실패했습니다. JSON 형식을 정확하게 지켜주세요.)',
                    levelData: {
                        levelName: this.levelName,
                        objects: this.objects,
                        gridSize: this.gridSize
                    }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.parseAIResponse(data.response, retryCount);
            }
        } catch (err) {
            console.error('AI 재시도 실패:', err);
            this.addAIStatusMessage('error', '❌ 재시도 실패');
        }
    }
    
    showAIPreview() {
        // render()를 호출하면 renderAIPreviewOverlay()가 자동으로 그려짐
        this.render();
    }
    
    // AI 미리보기에서 오브젝트 클릭 토글
    handleAIPreviewClick(worldX, worldY) {
        if (!this.aiPendingObjects) return false;
        
        for (let i = 0; i < this.aiPendingObjects.length; i++) {
            const obj = this.aiPendingObjects[i];
            if (obj.type === 'polyfloor' && obj.points && this.isPointInPolygon(worldX, worldY, obj.points)) {
                if (!this.aiSelectedIndices) this.aiSelectedIndices = new Set();
                
                if (this.aiSelectedIndices.has(i)) {
                    this.aiSelectedIndices.delete(i);
                } else {
                    this.aiSelectedIndices.add(i);
                }
                this.showAIPreview();
                this.updateAISelectionUI();
                return true;
            }
        }
        return false;
    }
    
    updateAISelectionUI() {
        const countEl = document.getElementById('aiSelectedCount');
        if (countEl && this.aiSelectedIndices) {
            countEl.textContent = `${this.aiSelectedIndices.size}/${this.aiPendingObjects.length} 선택됨`;
        }
    }
    
    addAIActionButtons(description) {
        // 기존 패널 제거
        document.getElementById('aiFloatingPanel')?.remove();
        
        // 초기 선택: 모두 선택
        this.aiSelectedIndices = new Set(this.aiPendingObjects.map((_, i) => i));
        
        // 캔버스 위에 플로팅 패널 생성
        const panel = document.createElement('div');
        panel.id = 'aiFloatingPanel';
        panel.className = 'ai-floating-panel';
        
        // 오브젝트 목록 생성
        let listHtml = this.aiPendingObjects.map((obj, i) => `
            <label class="ai-obj-item" data-idx="${i}">
                <input type="checkbox" checked onchange="app.toggleAIObject(${i}, this.checked)">
                <span>${i + 1}. ${obj.label || obj.type}</span>
            </label>
        `).join('');
        
        panel.innerHTML = `
            <div class="ai-floating-header">🤖 AI 생성 (${this.aiPendingObjects.length}개)</div>
            <div class="ai-obj-list">${listHtml}</div>
            <div class="ai-floating-footer">
                <span id="aiSelectedCount">${this.aiPendingObjects.length}개 선택</span>
                <div class="ai-floating-btns">
                    <button class="ai-apply-btn" onclick="app.applyAIObjects()">✅ 적용</button>
                    <button class="ai-cancel-btn" onclick="app.cancelAIObjects()">❌ 취소</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.showAIPreview();
    }
    
    toggleAIObject(idx, checked) {
        if (!this.aiSelectedIndices) this.aiSelectedIndices = new Set();
        
        if (checked) {
            this.aiSelectedIndices.add(idx);
        } else {
            this.aiSelectedIndices.delete(idx);
        }
        this.updateAISelectionUI();
        this.showAIPreview();
    }
    
    applyAIObjects() {
        if (!this.aiPendingObjects || this.aiPendingObjects.length === 0) return;
        
        // 선택된 것만 적용
        const toApply = this.aiPendingObjects.filter((_, i) => this.aiSelectedIndices?.has(i));
        
        if (toApply.length === 0) {
            this.showToast('선택된 오브젝트가 없습니다');
            return;
        }
        
        toApply.forEach(obj => {
            this.objects.push(obj);
        });
        
        const count = toApply.length;
        this.aiPendingObjects = null;
        this.aiSelectedIndices = null;
        
        this.saveState();
        this.updateObjectsList();
        this.render();
        this.showToast(`🤖 ${count}개 오브젝트 추가됨`);
        this.hideAIStatus();
        
        document.getElementById('aiFloatingPanel')?.remove();
    }
    
    cancelAIObjects() {
        this.aiPendingObjects = null;
        this.aiSelectedIndices = null;
        this.render();
        this.showToast('AI 제안 취소됨');
        this.hideAIStatus();
        
        document.getElementById('aiFloatingPanel')?.remove();
    }
    
    // AI 영역 지정 모드
    startAIAreaSelection() {
        this.aiAreaMode = true;
        this.showToast('🤖 AI 작업 영역을 드래그로 지정하세요');
        document.body.style.cursor = 'crosshair';
    }
    
    handleAIAreaDrag(startX, startY, endX, endY) {
        this.aiAreaSelection = { startX, startY, endX, endY };
        this.render();
        this.showAIPreview();
    }
    
    finishAIAreaSelection() {
        if (!this.aiAreaSelection) return;
        
        const { startX, startY, endX, endY } = this.aiAreaSelection;
        const x1 = Math.min(startX, endX);
        const y1 = Math.min(startY, endY);
        const x2 = Math.max(startX, endX);
        const y2 = Math.max(startY, endY);
        const w = x2 - x1;
        const h = y2 - y1;
        
        // 최소 크기 체크
        if (w < 64 || h < 64) {
            this.aiAreaSelection = null;
            this.aiAreaMode = false;
            document.body.style.cursor = '';
            this.render();
            this.showToast('영역이 너무 작습니다 (최소 2m x 2m)');
            return;
        }
        
        this.aiAreaMode = false;
        document.body.style.cursor = '';
        
        // 영역 정보 저장 (렌더링용)
        this.pendingAIArea = { x1, y1, x2, y2, w, h };
        
        // 프롬프트 입력 모달 표시
        this.showAIPromptModal(x1, y1, x2, y2, w, h);
    }
    
    showAIPromptModal(x1, y1, x2, y2, w, h) {
        // 기존 모달 제거
        document.getElementById('aiPromptModal')?.remove();
        
        const defaultPrompt = `이 영역(${Math.round(w/32)}m x ${Math.round(h/32)}m)에 바닥을 만들어줘. 기존 바닥과 연결되도록.`;
        
        const modal = document.createElement('div');
        modal.id = 'aiPromptModal';
        modal.className = 'ai-prompt-modal';
        modal.innerHTML = `
            <div class="ai-prompt-content">
                <div class="ai-prompt-header">
                    📐 영역 지정 완료
                    <span class="ai-prompt-size">${Math.round(w/32)}m × ${Math.round(h/32)}m</span>
                </div>
                <div class="ai-prompt-coords">
                    좌표: (${Math.round(x1)}, ${Math.round(y1)}) ~ (${Math.round(x2)}, ${Math.round(y2)})
                </div>
                <textarea id="aiAreaPrompt" class="ai-prompt-textarea" rows="3">${defaultPrompt}</textarea>
                <div class="ai-prompt-btns">
                    <button class="ai-cancel-btn" onclick="app.cancelAIArea()">취소</button>
                    <button class="ai-apply-btn" onclick="app.sendAIAreaRequest()">🤖 AI 생성</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('aiAreaPrompt')?.focus();
        
        this.render(); // 영역 표시 유지
    }
    
    cancelAIArea() {
        this.aiAreaSelection = null;
        this.pendingAIArea = null;
        document.getElementById('aiPromptModal')?.remove();
        this.render();
    }
    
    async sendAIAreaRequest() {
        const textarea = document.getElementById('aiAreaPrompt');
        const userPrompt = textarea?.value?.trim();
        
        if (!userPrompt) {
            this.showToast('프롬프트를 입력해주세요');
            return;
        }
        
        const area = this.pendingAIArea;
        if (!area) return;
        
        // 모달 닫기
        document.getElementById('aiPromptModal')?.remove();
        
        // 영역 정보 포함한 프롬프트
        const fullPrompt = `영역 좌표: (${Math.round(area.x1)}, ${Math.round(area.y1)}) ~ (${Math.round(area.x2)}, ${Math.round(area.y2)}), 크기 ${Math.round(area.w/32)}m x ${Math.round(area.h/32)}m

사용자 요청: ${userPrompt}`;
        
        this.updateAIStatus('🤖 생성 중...', 'loading');
        
        try {
            const response = await fetch('http://localhost:3001/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: fullPrompt,
                    levelData: {
                        levelName: this.levelName,
                        objects: this.objects,
                        gridSize: this.gridSize
                    }
                })
            });
            
            if (!response.ok) throw new Error('AI 서버 오류');
            
            const data = await response.json();
            const success = this.parseAIResponse(data.response);
            
            if (success) {
                this.updateAIStatus('✅ 생성 완료', 'success');
            }
            
        } catch (err) {
            this.updateAIStatus('❌ AI 서버 연결 실패', 'error');
            console.error('AI 오류:', err);
        }
        
        // 영역 선택 초기화
        this.aiAreaSelection = null;
        this.pendingAIArea = null;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LevelForge();
});
