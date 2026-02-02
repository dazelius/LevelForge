"""
절차적 맵 생성 (규칙 기반)

택티컬 슈터 맵의 원칙:
1. 필수 요소: 공격 스폰, 수비 스폰, A사이트, B사이트
2. 3레인 구조: A레인, Mid, B레인
3. 밸런스: 공격 도달시간 > 수비 도달시간
4. 루트 다양성: 사이트당 최소 2개 경로
5. 초크포인트: 병목 지점 존재
6. 로테이션: 수비 사이트간 이동 가능
"""

import numpy as np
from typing import Tuple, Dict, List
from .base import MapTemplate, Tile


class ProceduralTemplate(MapTemplate):
    """
    규칙 기반 절차적 맵 생성
    템플릿 없이 원칙에 따라 새로운 레이아웃 생성
    """
    name = "Procedural"
    game = "Generated"
    size = 150
    
    # 맵 구조 규칙
    RULES = {
        'min_site_size': 22,
        'max_site_size': 35,
        'min_spawn_size': 18,
        'max_spawn_size': 28,
        'min_room_size': 10,
        'max_room_size': 20,
        'min_corridor_width': 4,
        'max_corridor_width': 8,
        'atk_def_ratio_min': 1.1,  # 공격이 수비보다 10% 이상 늦게
        'atk_def_ratio_max': 1.5,  # 50% 이하로 늦게
        'min_routes_per_site': 2,
        'min_chokepoints': 2,
        'max_chokepoints': 5,
    }
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # 1. 맵 레이아웃 타입 선택
        layout_type = np.random.choice([
            'classic_3lane',   # 클래식 3레인 (Dust2, Mirage)
            'wide_mid',        # 넓은 Mid (Ascent)
            'narrow_mid',      # 좁은 Mid (Split)
            'no_mid',          # Mid 없음 (Bind)
            'asymmetric',      # 비대칭 (Inferno)
        ])
        
        # 2. 필수 요소 배치 (규칙에 따라)
        cls._place_spawns(m, rooms, s, layout_type)
        cls._place_sites(m, rooms, s, layout_type)
        
        # 3. 레인 구조 생성
        cls._create_lanes(m, rooms, s, layout_type)
        
        # 4. 추가 방/공간 생성
        cls._add_supporting_rooms(m, rooms, s, layout_type)
        
        # 5. 연결 구조 완성
        cls._connect_all(m, rooms, s)
        
        # 6. 규칙 검증 및 수정
        cls._validate_and_fix(m, rooms, s)
        
        # 7. 벽 생성
        cls.generate_walls(m)
        
        return m, rooms
    
    @classmethod
    def _place_spawns(cls, m, rooms, s, layout_type):
        """스폰 위치 배치 (규칙: 서로 멀리)"""
        r = cls.RULES
        
        # 공격 스폰: 항상 하단
        atk_w = np.random.randint(r['min_spawn_size'], r['max_spawn_size'])
        atk_h = np.random.randint(r['min_spawn_size'], r['max_spawn_size'] - 5)
        atk_x = s//2 - atk_w//2 + np.random.randint(-15, 16)
        atk_y = s - atk_h - np.random.randint(8, 20)
        cls.create_room(m, rooms, "ATK_SPAWN", atk_x, atk_y, atk_w, atk_h, Tile.SPAWN_ATK)
        
        # 수비 스폰: 항상 상단 (사이트 사이)
        def_w = np.random.randint(r['min_spawn_size'], r['max_spawn_size'])
        def_h = np.random.randint(r['min_spawn_size'] - 5, r['max_spawn_size'] - 8)
        def_x = s//2 - def_w//2 + np.random.randint(-10, 11)
        def_y = np.random.randint(5, 18)
        cls.create_room(m, rooms, "DEF_SPAWN", def_x, def_y, def_w, def_h, Tile.SPAWN_DEF)
    
    @classmethod
    def _place_sites(cls, m, rooms, s, layout_type):
        """사이트 배치 (규칙: A는 한쪽, B는 반대쪽)"""
        r = cls.RULES
        
        # A 사이트: 좌측 또는 우측 상단
        a_side = np.random.choice(['left', 'right'])
        a_w = np.random.randint(r['min_site_size'], r['max_site_size'])
        a_h = np.random.randint(r['min_site_size'], r['max_site_size'])
        
        if a_side == 'left':
            a_x = np.random.randint(8, 25)
        else:
            a_x = s - a_w - np.random.randint(8, 25)
        a_y = np.random.randint(15, 35)
        cls.create_room(m, rooms, "A_SITE", a_x, a_y, a_w, a_h, Tile.SITE_A)
        
        # B 사이트: A 반대편
        b_w = np.random.randint(r['min_site_size'], r['max_site_size'])
        b_h = np.random.randint(r['min_site_size'], r['max_site_size'])
        
        if a_side == 'left':
            b_x = s - b_w - np.random.randint(8, 25)
        else:
            b_x = np.random.randint(8, 25)
        b_y = np.random.randint(15, 40)
        cls.create_room(m, rooms, "B_SITE", b_x, b_y, b_w, b_h, Tile.SITE_B)
    
    @classmethod
    def _create_lanes(cls, m, rooms, s, layout_type):
        """레인 구조 생성"""
        r = cls.RULES
        
        a_site = rooms['A_SITE']
        b_site = rooms['B_SITE']
        atk = rooms['ATK_SPAWN']
        
        # A 레인: 공격 스폰 → A 사이트
        cls._create_lane_rooms(m, rooms, s, 'A', a_site, atk, layout_type)
        
        # B 레인: 공격 스폰 → B 사이트
        cls._create_lane_rooms(m, rooms, s, 'B', b_site, atk, layout_type)
        
        # Mid (레이아웃에 따라)
        if layout_type != 'no_mid':
            cls._create_mid(m, rooms, s, layout_type)
    
    @classmethod
    def _create_lane_rooms(cls, m, rooms, s, lane: str, site: Dict, atk: Dict, layout_type):
        """개별 레인의 방들 생성"""
        r = cls.RULES
        
        site_cx = site['x'] + site['w']//2
        site_cy = site['y'] + site['h']//2
        atk_cx = atk['x'] + atk['w']//2
        atk_cy = atk['y'] + atk['h']//2
        
        # 메인 통로 (공격 스폰에서 사이트 방향)
        main_w = np.random.randint(r['min_room_size'], r['max_room_size'])
        main_h = np.random.randint(20, 35)
        main_x = site_cx - main_w//2 + np.random.randint(-8, 9)
        main_y = s//2 + np.random.randint(-5, 15)
        main_x = np.clip(main_x, 5, s - main_w - 5)
        cls.create_room(m, rooms, f"{lane}_MAIN", main_x, main_y, main_w, main_h, None)
        
        # 로비 (스폰 근처)
        lobby_w = np.random.randint(r['min_room_size'] + 5, r['max_room_size'] + 5)
        lobby_h = np.random.randint(r['min_room_size'], r['max_room_size'])
        lobby_x = (site_cx + atk_cx)//2 - lobby_w//2 + np.random.randint(-10, 11)
        lobby_y = s - 55 + np.random.randint(-5, 10)
        lobby_x = np.clip(lobby_x, 5, s - lobby_w - 5)
        cls.create_room(m, rooms, f"{lane}_LOBBY", lobby_x, lobby_y, lobby_w, lobby_h, None)
        
        # 사이트 진입로
        entry_w = np.random.randint(r['min_room_size'], r['max_room_size'])
        entry_h = np.random.randint(r['min_room_size'], r['max_room_size'])
        entry_x = site_cx - entry_w//2 + np.random.randint(-5, 6)
        entry_y = site['y'] + site['h'] + np.random.randint(3, 12)
        entry_x = np.clip(entry_x, 5, s - entry_w - 5)
        entry_y = np.clip(entry_y, 5, s - entry_h - 5)
        cls.create_room(m, rooms, f"{lane}_ENTRY", entry_x, entry_y, entry_w, entry_h, None)
    
    @classmethod
    def _create_mid(cls, m, rooms, s, layout_type):
        """Mid 영역 생성"""
        r = cls.RULES
        
        if layout_type == 'wide_mid':
            mid_w = np.random.randint(25, 40)
            mid_h = np.random.randint(35, 50)
        elif layout_type == 'narrow_mid':
            mid_w = np.random.randint(12, 20)
            mid_h = np.random.randint(30, 45)
        else:  # classic
            mid_w = np.random.randint(18, 28)
            mid_h = np.random.randint(30, 45)
        
        mid_x = s//2 - mid_w//2 + np.random.randint(-8, 9)
        mid_y = s//2 - mid_h//2 + np.random.randint(-10, 5)
        cls.create_room(m, rooms, "MID", mid_x, mid_y, mid_w, mid_h, None)
        
        # Mid 상단 (수비 스폰 연결용)
        top_w = np.random.randint(r['min_room_size'], r['max_room_size'])
        top_h = np.random.randint(r['min_room_size'], r['max_room_size'])
        top_x = s//2 - top_w//2 + np.random.randint(-5, 6)
        top_y = np.random.randint(25, 38)
        cls.create_room(m, rooms, "MID_TOP", top_x, top_y, top_w, top_h, None)
        
        # Mid 하단 (공격 스폰 연결용)
        bot_w = np.random.randint(r['min_room_size'] + 3, r['max_room_size'] + 3)
        bot_h = np.random.randint(r['min_room_size'], r['max_room_size'])
        bot_x = s//2 - bot_w//2 + np.random.randint(-8, 9)
        bot_y = s - 55 + np.random.randint(-5, 10)
        cls.create_room(m, rooms, "MID_ENTRANCE", bot_x, bot_y, bot_w, bot_h, None)
    
    @classmethod
    def _add_supporting_rooms(cls, m, rooms, s, layout_type):
        """보조 방 추가 (Heaven, 사이드 통로 등)"""
        r = cls.RULES
        
        # A Heaven (수비 위치)
        if 'A_SITE' in rooms:
            a = rooms['A_SITE']
            h_w = np.random.randint(12, 18)
            h_h = np.random.randint(10, 15)
            h_x = a['x'] + np.random.randint(0, a['w'] - h_w)
            h_y = a['y'] - h_h - np.random.randint(2, 8)
            if h_y > 5:
                cls.create_room(m, rooms, "A_HEAVEN", h_x, max(5, h_y), h_w, h_h, None)
        
        # B Heaven
        if 'B_SITE' in rooms:
            b = rooms['B_SITE']
            h_w = np.random.randint(12, 18)
            h_h = np.random.randint(10, 15)
            h_x = b['x'] + np.random.randint(0, max(1, b['w'] - h_w))
            h_y = b['y'] - h_h - np.random.randint(2, 8)
            if h_y > 5:
                cls.create_room(m, rooms, "B_HEAVEN", h_x, max(5, h_y), h_w, h_h, None)
        
        # 추가 연결 통로 (루트 다양성)
        num_extra = np.random.randint(2, 5)
        for i in range(num_extra):
            ex_w = np.random.randint(r['min_room_size'], r['max_room_size'])
            ex_h = np.random.randint(r['min_room_size'], r['max_room_size'])
            ex_x = np.random.randint(15, s - ex_w - 15)
            ex_y = np.random.randint(30, s - ex_h - 40)
            
            # 기존 방과 겹치지 않으면 추가
            overlap = False
            for name, room in rooms.items():
                if (ex_x < room['x'] + room['w'] + 5 and ex_x + ex_w + 5 > room['x'] and
                    ex_y < room['y'] + room['h'] + 5 and ex_y + ex_h + 5 > room['y']):
                    overlap = True
                    break
            
            if not overlap:
                cls.create_room(m, rooms, f"CONNECTOR_{i}", ex_x, ex_y, ex_w, ex_h, None)
    
    @classmethod
    def _connect_all(cls, m, rooms, s):
        """모든 방 연결"""
        # 필수 연결
        essential = [
            # 공격 스폰 → 각 레인
            ("ATK_SPAWN", "A_LOBBY"),
            ("ATK_SPAWN", "B_LOBBY"),
            
            # 레인 연결
            ("A_LOBBY", "A_MAIN"),
            ("A_MAIN", "A_ENTRY"),
            ("A_ENTRY", "A_SITE"),
            
            ("B_LOBBY", "B_MAIN"),
            ("B_MAIN", "B_ENTRY"),
            ("B_ENTRY", "B_SITE"),
            
            # 수비 스폰 연결
            ("DEF_SPAWN", "A_HEAVEN"),
            ("DEF_SPAWN", "B_HEAVEN"),
            ("A_HEAVEN", "A_SITE"),
            ("B_HEAVEN", "B_SITE"),
        ]
        
        # Mid 연결
        if "MID" in rooms:
            essential.extend([
                ("ATK_SPAWN", "MID_ENTRANCE"),
                ("MID_ENTRANCE", "MID"),
                ("MID", "MID_TOP"),
                ("MID_TOP", "DEF_SPAWN"),
                ("MID", "A_ENTRY"),
                ("MID", "B_ENTRY"),
            ])
        
        for r1, r2 in essential:
            if r1 in rooms and r2 in rooms:
                width = np.random.randint(cls.RULES['min_corridor_width'], 
                                         cls.RULES['max_corridor_width'])
                cls.connect_rooms(m, rooms, r1, r2, width)
        
        # 추가 연결 (CONNECTOR들)
        connectors = [n for n in rooms if n.startswith("CONNECTOR")]
        for conn in connectors:
            # 가장 가까운 2개 방에 연결
            distances = []
            for name, room in rooms.items():
                if name != conn and not name.startswith("CONNECTOR"):
                    c_room = rooms[conn]
                    dist = abs(room['x'] - c_room['x']) + abs(room['y'] - c_room['y'])
                    distances.append((dist, name))
            
            distances.sort()
            for _, target in distances[:2]:
                width = np.random.randint(3, 6)
                cls.connect_rooms(m, rooms, conn, target, width)
    
    @classmethod
    def _validate_and_fix(cls, m, rooms, s):
        """규칙 검증 및 수정"""
        # 연결성 확인
        cls._ensure_connectivity(m, rooms, s)
    
    @classmethod
    def _ensure_connectivity(cls, m, rooms, s):
        """모든 주요 지점이 연결되어 있는지 확인"""
        from collections import deque
        
        walkable = {Tile.FLOOR, Tile.SITE_A, Tile.SITE_B, Tile.SPAWN_ATK, Tile.SPAWN_DEF}
        
        required_pairs = [
            ("ATK_SPAWN", "A_SITE"),
            ("ATK_SPAWN", "B_SITE"),
            ("DEF_SPAWN", "A_SITE"),
            ("DEF_SPAWN", "B_SITE"),
        ]
        
        for start_name, end_name in required_pairs:
            if start_name not in rooms or end_name not in rooms:
                continue
            
            start_room = rooms[start_name]
            end_room = rooms[end_name]
            
            start = (start_room['y'] + start_room['h']//2, start_room['x'] + start_room['w']//2)
            end = (end_room['y'] + end_room['h']//2, end_room['x'] + end_room['w']//2)
            
            # BFS로 연결 확인
            visited = {start}
            queue = deque([start])
            found = False
            
            while queue and not found:
                cy, cx = queue.popleft()
                if abs(cy - end[0]) <= 8 and abs(cx - end[1]) <= 8:
                    found = True
                    break
                
                for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    ny, nx = cy + dy, cx + dx
                    if (ny, nx) not in visited and 0 <= ny < s and 0 <= nx < s:
                        if m[ny, nx] in walkable:
                            visited.add((ny, nx))
                            queue.append((ny, nx))
            
            # 연결 안 되면 강제 연결
            if not found:
                cls.connect_rooms(m, rooms, start_name, end_name, 5)
