"""
Procedural Map Generator v3 - 유기적 형태

특징:
1. Voronoi 기반 방 분할 (자연스러운 불규칙 형태)
2. 대각선 통로 지원
3. 노이즈 기반 경계 왜곡
4. 다양한 방 크기 (작은 방 ~ 큰 광장)
5. 복잡한 다중 경로
"""

import numpy as np
from typing import Tuple, Dict, List, Set, Optional
from .base import MapTemplate, Tile
from collections import deque
import math


class ProceduralV3Template(MapTemplate):
    """
    유기적 형태 맵 생성
    """
    name = "ProceduralV3"
    game = "Generated"
    size = 150
    
    # ========================================
    # 디자인 규칙
    # ========================================
    DESIGN_RULES = {
        # 기본 크기
        'site_size': (20, 35),
        'spawn_size': (18, 28),
        'room_size': (8, 25),
        'corridor_width': (4, 8),
        
        # 유기적 형태
        'organic_level': 0.5,        # 0=직사각형, 1=완전 유기적
        'diagonal_ratio': 0.3,       # 대각선 통로 비율
        'corner_noise': 0.2,         # 모서리 노이즈
        'room_irregularity': 0.4,    # 방 불규칙도
        
        # 연결 복잡도
        'path_complexity': 3,        # 경로 복잡도 (1-5)
        'loop_count': 2,             # 순환 경로 수
        'flank_routes': 2,           # 플랭크 경로 수
        
        # 타이밍
        'max_straight_corridor': 20,
        'corridor_min_width': 4,
        'corridor_max_width': 8,
    }
    
    _active_rules = None
    
    @classmethod
    def generate(cls, seed=None, rules=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        # 규칙 병합
        active_rules = cls.DESIGN_RULES.copy()
        if rules:
            cls._merge_rules(active_rules, rules)
        cls._active_rules = active_rules
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # 1. 핵심 지점 (Voronoi 시드) 배치
        key_points = cls._place_key_points_voronoi(s)
        
        # 2. Voronoi 기반 영역 분할
        regions = cls._voronoi_regions(s, key_points)
        
        # 3. 각 영역을 유기적 방으로 변환
        cls._create_organic_rooms(m, rooms, regions, key_points, s)
        
        # 4. 대각선 포함 유기적 통로 연결
        cls._connect_organic(m, rooms, s)
        
        # 5. 순환 경로 및 플랭크 추가
        cls._add_loops_and_flanks(m, rooms, s)
        
        # 6. 경계 노이즈 적용
        cls._apply_boundary_noise(m, s)
        
        # 7. 검증
        cls._validate_connectivity(m, rooms, s)
        
        return m, rooms
    
    @classmethod
    def _merge_rules(cls, base: dict, override: dict):
        """규칙 병합"""
        mapping = {
            ('timing', 'atk_to_site'): 'atk_to_site_time',
            ('corridors', 'max_straight'): 'max_straight_corridor',
            ('corridors', 'width'): 'corridor_width',
            ('organic', 'level'): 'organic_level',
            ('organic', 'diagonal'): 'diagonal_ratio',
            ('organic', 'noise'): 'corner_noise',
            ('organic', 'irregularity'): 'room_irregularity',
            ('complexity', 'paths'): 'path_complexity',
            ('complexity', 'loops'): 'loop_count',
            ('complexity', 'flanks'): 'flank_routes',
        }
        
        for (cat, key), target in mapping.items():
            if cat in override and key in override[cat]:
                base[target] = override[cat][key]
    
    @classmethod
    def _place_key_points_voronoi(cls, s: int) -> Dict[str, Tuple[int, int]]:
        """핵심 지점들을 Voronoi 시드로 배치"""
        margin = 15
        points = {}
        
        # ATK Spawn (하단 중앙)
        points['ATK_SPAWN'] = (s - margin - 10, s // 2)
        
        # DEF Spawn (상단 중앙)
        points['DEF_SPAWN'] = (margin + 10, s // 2)
        
        # A Site (우상단)
        points['A_SITE'] = (margin + 25, s - margin - 30)
        
        # B Site (좌상단)
        points['B_SITE'] = (margin + 25, margin + 30)
        
        # Mid (중앙)
        points['MID'] = (s // 2, s // 2)
        
        # 추가 영역들 (랜덤하게)
        extra_rooms = [
            'A_MAIN', 'A_LOBBY', 'A_HEAVEN',
            'B_MAIN', 'B_LOBBY', 'B_HEAVEN',
            'MID_TOP', 'MID_BOTTOM',
            'A_CONNECTOR', 'B_CONNECTOR'
        ]
        
        for name in extra_rooms:
            # 기존 점들과 겹치지 않게 배치
            for _ in range(50):
                y = np.random.randint(margin + 10, s - margin - 10)
                x = np.random.randint(margin + 10, s - margin - 10)
                
                # 최소 거리 체크
                min_dist = min(
                    math.sqrt((y - py)**2 + (x - px)**2)
                    for py, px in points.values()
                )
                
                if min_dist > 20:
                    points[name] = (y, x)
                    break
        
        return points
    
    @classmethod
    def _voronoi_regions(cls, s: int, points: Dict[str, Tuple[int, int]]) -> Dict[str, Set[Tuple[int, int]]]:
        """Voronoi 다이어그램으로 영역 분할"""
        regions = {name: set() for name in points}
        point_list = list(points.items())
        
        for y in range(s):
            for x in range(s):
                # 가장 가까운 시드 찾기
                min_dist = float('inf')
                closest = None
                
                for name, (py, px) in point_list:
                    # 맨해튼 거리 + 약간의 유클리드 혼합 (더 유기적)
                    dist = abs(y - py) + abs(x - px) + 0.3 * math.sqrt((y - py)**2 + (x - px)**2)
                    
                    # 노이즈 추가
                    noise = np.random.random() * 5 * cls._active_rules.get('organic_level', 0.5)
                    dist += noise
                    
                    if dist < min_dist:
                        min_dist = dist
                        closest = name
                
                if closest:
                    regions[closest].add((y, x))
        
        return regions
    
    @classmethod
    def _create_organic_rooms(cls, m: np.ndarray, rooms: dict, 
                              regions: Dict[str, Set], 
                              key_points: Dict[str, Tuple[int, int]], s: int):
        """Voronoi 영역을 유기적 방으로 변환"""
        
        for name, tiles in regions.items():
            if not tiles:
                continue
            
            center_y, center_x = key_points[name]
            
            # 방 크기 결정
            if 'SITE' in name:
                size_range = cls._active_rules['site_size']
            elif 'SPAWN' in name:
                size_range = cls._active_rules['spawn_size']
            else:
                size_range = cls._active_rules['room_size']
            
            target_size = np.random.randint(size_range[0], size_range[1])
            
            # 중심에서부터 타일 선택 (유기적 형태)
            room_tiles = cls._grow_organic_room(tiles, center_y, center_x, target_size, s)
            
            # 타일을 FLOOR로 설정
            for ty, tx in room_tiles:
                if 0 <= ty < s and 0 <= tx < s:
                    m[ty, tx] = Tile.FLOOR
            
            # 방 정보 저장
            if room_tiles:
                ys = [t[0] for t in room_tiles]
                xs = [t[1] for t in room_tiles]
                rooms[name] = {
                    'x': min(xs),
                    'y': min(ys),
                    'w': max(xs) - min(xs) + 1,
                    'h': max(ys) - min(ys) + 1,
                    'center': (center_y, center_x),
                    'tiles': room_tiles
                }
    
    @classmethod
    def _grow_organic_room(cls, available: Set, center_y: int, center_x: int, 
                           target_size: int, s: int) -> Set[Tuple[int, int]]:
        """중심에서 유기적으로 방 확장"""
        if (center_y, center_x) not in available:
            # 가장 가까운 available 타일 찾기
            if available:
                center_y, center_x = min(available, 
                    key=lambda t: abs(t[0] - center_y) + abs(t[1] - center_x))
            else:
                return set()
        
        room = {(center_y, center_x)}
        frontier = [(center_y, center_x)]
        
        irregularity = cls._active_rules.get('room_irregularity', 0.4)
        
        while len(room) < target_size and frontier:
            # 랜덤하게 frontier에서 선택 (불규칙성)
            if np.random.random() < irregularity:
                idx = np.random.randint(0, len(frontier))
            else:
                idx = 0
            
            cy, cx = frontier.pop(idx)
            
            # 8방향 이웃 (대각선 포함)
            neighbors = [
                (cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1),
                (cy - 1, cx - 1), (cy - 1, cx + 1), (cy + 1, cx - 1), (cy + 1, cx + 1)
            ]
            
            np.random.shuffle(neighbors)
            
            for ny, nx in neighbors:
                if (ny, nx) in available and (ny, nx) not in room:
                    if 0 <= ny < s and 0 <= nx < s:
                        room.add((ny, nx))
                        frontier.append((ny, nx))
                        
                        if len(room) >= target_size:
                            break
        
        return room
    
    @classmethod
    def _connect_organic(cls, m: np.ndarray, rooms: dict, s: int):
        """유기적 통로로 방 연결 (대각선 포함)"""
        
        # 연결할 방 쌍 정의
        connections = [
            # ATK → 사이트
            ('ATK_SPAWN', 'A_LOBBY'),
            ('ATK_SPAWN', 'B_LOBBY'),
            ('ATK_SPAWN', 'MID_BOTTOM'),
            
            # MID 연결
            ('MID_BOTTOM', 'MID'),
            ('MID', 'MID_TOP'),
            
            # A 사이트 연결
            ('A_LOBBY', 'A_MAIN'),
            ('A_MAIN', 'A_SITE'),
            ('MID', 'A_CONNECTOR'),
            ('A_CONNECTOR', 'A_SITE'),
            
            # B 사이트 연결
            ('B_LOBBY', 'B_MAIN'),
            ('B_MAIN', 'B_SITE'),
            ('MID', 'B_CONNECTOR'),
            ('B_CONNECTOR', 'B_SITE'),
            
            # DEF → 사이트
            ('DEF_SPAWN', 'A_SITE'),
            ('DEF_SPAWN', 'B_SITE'),
            ('DEF_SPAWN', 'MID_TOP'),
        ]
        
        diagonal_ratio = cls._active_rules.get('diagonal_ratio', 0.3)
        
        for room1, room2 in connections:
            if room1 not in rooms or room2 not in rooms:
                continue
            
            c1 = rooms[room1].get('center', (rooms[room1]['y'], rooms[room1]['x']))
            c2 = rooms[room2].get('center', (rooms[room2]['y'], rooms[room2]['x']))
            
            # 대각선 또는 직선 선택
            use_diagonal = np.random.random() < diagonal_ratio
            
            if use_diagonal:
                cls._draw_diagonal_corridor(m, c1, c2, s)
            else:
                cls._draw_organic_corridor(m, c1, c2, s)
    
    @classmethod
    def _draw_diagonal_corridor(cls, m: np.ndarray, start: Tuple[int, int], 
                                 end: Tuple[int, int], s: int):
        """대각선 통로 그리기"""
        y1, x1 = start
        y2, x2 = end
        
        width = np.random.randint(
            cls._active_rules['corridor_min_width'],
            cls._active_rules['corridor_max_width']
        )
        
        # Bresenham 라인 알고리즘 (두꺼운 선)
        dy = abs(y2 - y1)
        dx = abs(x2 - x1)
        
        steps = max(dy, dx)
        if steps == 0:
            return
        
        for i in range(steps + 1):
            t = i / steps
            cy = int(y1 + t * (y2 - y1))
            cx = int(x1 + t * (x2 - x1))
            
            # 통로 너비만큼 채우기
            for wy in range(-width // 2, width // 2 + 1):
                for wx in range(-width // 2, width // 2 + 1):
                    ny, nx = cy + wy, cx + wx
                    if 0 <= ny < s and 0 <= nx < s:
                        m[ny, nx] = Tile.FLOOR
    
    @classmethod
    def _draw_organic_corridor(cls, m: np.ndarray, start: Tuple[int, int], 
                                end: Tuple[int, int], s: int):
        """유기적 굴곡 통로 그리기"""
        y1, x1 = start
        y2, x2 = end
        
        width = np.random.randint(
            cls._active_rules['corridor_min_width'],
            cls._active_rules['corridor_max_width']
        )
        
        max_straight = cls._active_rules.get('max_straight_corridor', 20)
        
        # 중간점 추가 (굴곡)
        dist = abs(y2 - y1) + abs(x2 - x1)
        
        if dist > max_straight:
            # 1~2개의 중간점 추가
            num_midpoints = 1 + (dist > max_straight * 2)
            points = [(y1, x1)]
            
            for i in range(num_midpoints):
                t = (i + 1) / (num_midpoints + 1)
                my = int(y1 + t * (y2 - y1))
                mx = int(x1 + t * (x2 - x1))
                
                # 약간의 오프셋
                offset = np.random.randint(-15, 16)
                if abs(y2 - y1) > abs(x2 - x1):
                    mx += offset
                else:
                    my += offset
                
                my = max(5, min(s - 5, my))
                mx = max(5, min(s - 5, mx))
                points.append((my, mx))
            
            points.append((y2, x2))
            
            # 각 구간 연결
            for i in range(len(points) - 1):
                cls._draw_corridor_segment(m, points[i], points[i + 1], width, s)
        else:
            cls._draw_corridor_segment(m, (y1, x1), (y2, x2), width, s)
    
    @classmethod
    def _draw_corridor_segment(cls, m: np.ndarray, start: Tuple[int, int], 
                                end: Tuple[int, int], width: int, s: int):
        """통로 세그먼트 그리기 (L자형)"""
        y1, x1 = start
        y2, x2 = end
        
        # 랜덤하게 수평-수직 또는 수직-수평
        if np.random.random() < 0.5:
            mid = (y1, x2)
        else:
            mid = (y2, x1)
        
        # 첫 번째 구간
        for y in range(min(y1, mid[0]), max(y1, mid[0]) + 1):
            for w in range(-width // 2, width // 2 + 1):
                nx = x1 + w
                if 0 <= y < s and 0 <= nx < s:
                    m[y, nx] = Tile.FLOOR
        
        for x in range(min(x1, mid[1]), max(x1, mid[1]) + 1):
            for w in range(-width // 2, width // 2 + 1):
                ny = y1 + w
                if 0 <= ny < s and 0 <= x < s:
                    m[ny, x] = Tile.FLOOR
        
        # 두 번째 구간
        for y in range(min(mid[0], y2), max(mid[0], y2) + 1):
            for w in range(-width // 2, width // 2 + 1):
                nx = mid[1] + w
                if 0 <= y < s and 0 <= nx < s:
                    m[y, nx] = Tile.FLOOR
        
        for x in range(min(mid[1], x2), max(mid[1], x2) + 1):
            for w in range(-width // 2, width // 2 + 1):
                ny = mid[0] + w
                if 0 <= ny < s and 0 <= x < s:
                    m[ny, x] = Tile.FLOOR
    
    @classmethod
    def _add_loops_and_flanks(cls, m: np.ndarray, rooms: dict, s: int):
        """순환 경로 및 플랭크 경로 추가"""
        loop_count = cls._active_rules.get('loop_count', 2)
        flank_count = cls._active_rules.get('flank_routes', 2)
        
        room_names = list(rooms.keys())
        
        # 순환 경로: 랜덤한 방들 연결
        for _ in range(loop_count):
            if len(room_names) < 2:
                break
            
            r1, r2 = np.random.choice(room_names, 2, replace=False)
            c1 = rooms[r1].get('center', (rooms[r1]['y'], rooms[r1]['x']))
            c2 = rooms[r2].get('center', (rooms[r2]['y'], rooms[r2]['x']))
            
            # 좁은 통로로 연결
            cls._draw_narrow_corridor(m, c1, c2, s)
        
        # 플랭크 경로: 사이트 주변 우회로
        flank_pairs = [
            ('A_MAIN', 'A_HEAVEN'),
            ('B_MAIN', 'B_HEAVEN'),
        ]
        
        for r1, r2 in flank_pairs[:flank_count]:
            if r1 in rooms and r2 in rooms:
                c1 = rooms[r1].get('center', (rooms[r1]['y'], rooms[r1]['x']))
                c2 = rooms[r2].get('center', (rooms[r2]['y'], rooms[r2]['x']))
                cls._draw_narrow_corridor(m, c1, c2, s)
    
    @classmethod
    def _draw_narrow_corridor(cls, m: np.ndarray, start: Tuple[int, int], 
                               end: Tuple[int, int], s: int):
        """좁은 통로 (플랭크용)"""
        width = cls._active_rules['corridor_min_width']
        cls._draw_diagonal_corridor(m, start, end, s)
    
    @classmethod
    def _apply_boundary_noise(cls, m: np.ndarray, s: int):
        """경계에 노이즈 적용 (유기적 형태)"""
        noise_level = cls._active_rules.get('corner_noise', 0.2)
        
        if noise_level <= 0:
            return
        
        # 경계 타일 찾기
        boundary_tiles = []
        for y in range(1, s - 1):
            for x in range(1, s - 1):
                if m[y, x] == Tile.FLOOR:
                    # 주변에 VOID가 있으면 경계
                    neighbors = [m[y-1, x], m[y+1, x], m[y, x-1], m[y, x+1]]
                    if Tile.VOID in neighbors:
                        boundary_tiles.append((y, x))
        
        # 일부 경계 타일 제거/추가 (노이즈)
        for y, x in boundary_tiles:
            if np.random.random() < noise_level * 0.3:
                # 랜덤하게 제거
                m[y, x] = Tile.VOID
            
            # 또는 주변에 추가
            if np.random.random() < noise_level * 0.2:
                ny, nx = y + np.random.choice([-1, 1]), x + np.random.choice([-1, 1])
                if 0 <= ny < s and 0 <= nx < s and m[ny, nx] == Tile.VOID:
                    m[ny, nx] = Tile.FLOOR
    
    @classmethod
    def _validate_connectivity(cls, m: np.ndarray, rooms: dict, s: int):
        """연결성 검증 및 수정"""
        # 모든 방이 연결되어 있는지 확인
        floor_tiles = set()
        for y in range(s):
            for x in range(s):
                if m[y, x] == Tile.FLOOR:
                    floor_tiles.add((y, x))
        
        if not floor_tiles:
            return
        
        # BFS로 연결된 타일 찾기
        start = next(iter(floor_tiles))
        visited = {start}
        queue = deque([start])
        
        while queue:
            cy, cx = queue.popleft()
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = cy + dy, cx + dx
                if (ny, nx) in floor_tiles and (ny, nx) not in visited:
                    visited.add((ny, nx))
                    queue.append((ny, nx))
        
        # 연결되지 않은 영역 연결
        disconnected = floor_tiles - visited
        if disconnected:
            # 가장 가까운 연결된 타일과 연결
            for dy, dx in disconnected:
                closest = min(visited, key=lambda t: abs(t[0] - dy) + abs(t[1] - dx))
                cls._draw_corridor_segment(m, (dy, dx), closest, 4, s)
                visited.add((dy, dx))
