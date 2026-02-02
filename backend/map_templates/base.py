"""
맵 템플릿 베이스 클래스
새 템플릿 추가 시 이 클래스를 상속받아 구현
"""

import numpy as np
from typing import Tuple, Dict
from abc import ABC, abstractmethod


# ============================================================
# 타일 타입 (1타일 = 1미터)
# ============================================================
class Tile:
    VOID = 0
    FLOOR = 1
    WALL = 2
    COVER_HALF = 3
    COVER_FULL = 4
    BOX = 5
    SITE_A = 6
    SITE_B = 7
    SPAWN_ATK = 8   # 공격팀 (T, 어택커)
    SPAWN_DEF = 9   # 수비팀 (CT, 디펜더)
    RAMP = 10
    PILLAR = 11


# 타일 색상 (RGB)
TILE_COLORS = {
    Tile.VOID: (12, 12, 28),
    Tile.FLOOR: (60, 55, 50),
    Tile.WALL: (90, 85, 75),
    Tile.COVER_HALF: (110, 90, 70),
    Tile.COVER_FULL: (130, 105, 80),
    Tile.BOX: (150, 120, 70),
    Tile.SITE_A: (255, 90, 90),
    Tile.SITE_B: (90, 200, 90),
    Tile.SPAWN_ATK: (220, 160, 60),
    Tile.SPAWN_DEF: (60, 140, 220),
    Tile.RAMP: (80, 75, 65),
    Tile.PILLAR: (100, 95, 85),
}


# ============================================================
# 맵 템플릿 베이스 클래스
# ============================================================
class MapTemplate(ABC):
    """
    맵 템플릿 베이스 클래스
    
    새 맵을 추가하려면:
    1. map_templates 폴더에 새 파일 생성 (예: ascent.py)
    2. 이 클래스를 상속받아 구현
    3. name, game, size 속성 정의
    4. generate() 메서드 구현
    
    예시:
    ```python
    from .base import MapTemplate, Tile
    
    class AscentTemplate(MapTemplate):
        name = "Ascent"
        game = "Valorant"
        size = 150
        
        @classmethod
        def generate(cls, seed=None):
            # 맵 생성 로직
            ...
    ```
    """
    
    name: str = "Base"
    game: str = "Unknown"  # CS, Valorant 등
    size: int = 150
    
    @classmethod
    @abstractmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        """
        맵 생성
        
        Args:
            seed: 랜덤 시드 (재현성을 위해)
        
        Returns:
            map_array: np.ndarray (size x size) - 타일 배열
            rooms: Dict - 방 정보 {이름: {x, y, w, h}}
        """
        raise NotImplementedError
    
    # ========================================
    # 유틸리티 메서드
    # ========================================
    
    @staticmethod
    def create_room(map_array: np.ndarray, rooms: Dict, 
                    name: str, x: int, y: int, w: int, h: int, 
                    marker_tile=None):
        """
        사각형 방 생성
        
        Args:
            map_array: 맵 배열
            rooms: 방 딕셔너리 (수정됨)
            name: 방 이름
            x, y: 좌상단 좌표
            w, h: 너비, 높이
            marker_tile: 중앙에 표시할 타일 (None이면 FLOOR만)
        """
        s = map_array.shape[0]
        x = max(2, min(x, s - w - 2))
        y = max(2, min(y, s - h - 2))
        rooms[name] = {'x': x, 'y': y, 'w': w, 'h': h}
        
        # 바닥 채우기
        for dy in range(h):
            for dx in range(w):
                if 0 <= y + dy < s and 0 <= x + dx < s:
                    map_array[y + dy, x + dx] = Tile.FLOOR
        
        # 마커 타일 (사이트, 스폰 등)
        if marker_tile is not None:
            cy, cx = y + h // 2, x + w // 2
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    if 0 <= cy + dy < s and 0 <= cx + dx < s:
                        map_array[cy + dy, cx + dx] = marker_tile
    
    @staticmethod
    def connect_rooms(map_array: np.ndarray, rooms: Dict, 
                      name1: str, name2: str, width: int = 4,
                      max_straight: int = 15):
        """
        두 방을 복도로 연결 (꺾임 포함)
        - 긴 직선은 중간에 꺾임 추가
        - max_straight: 최대 직선 길이 (기본 15타일 = 15m = 3초)
        """
        if name1 not in rooms or name2 not in rooms:
            return
        
        r1, r2 = rooms[name1], rooms[name2]
        cy1, cx1 = r1['y'] + r1['h']//2, r1['x'] + r1['w']//2
        cy2, cx2 = r2['y'] + r2['h']//2, r2['x'] + r2['w']//2
        half = width // 2
        s = map_array.shape[0]
        
        # 거리 계산
        dist_x = abs(cx2 - cx1)
        dist_y = abs(cy2 - cy1)
        
        # 긴 직선 방지 (파라미터화)
        MAX_STRAIGHT = max_straight
        
        if dist_x > MAX_STRAIGHT and dist_y > MAX_STRAIGHT:
            # S자 연결 (2번 꺾임)
            mid_x = (cx1 + cx2) // 2 + np.random.randint(-5, 6)
            mid_y1 = cy1 + (cy2 - cy1) // 3 + np.random.randint(-3, 4)
            mid_y2 = cy1 + (cy2 - cy1) * 2 // 3 + np.random.randint(-3, 4)
            
            # 1단계: cy1 → mid_y1 (수직)
            for y in range(min(cy1, mid_y1), max(cy1, mid_y1) + 1):
                for dx in range(-half, half + 1):
                    nx = cx1 + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
            
            # 2단계: cx1 → mid_x (수평, mid_y1 높이)
            for x in range(min(cx1, mid_x), max(cx1, mid_x) + 1):
                for dy in range(-half, half + 1):
                    ny = mid_y1 + dy
                    if 0 <= ny < s and 0 <= x < s and map_array[ny, x] == Tile.VOID:
                        map_array[ny, x] = Tile.FLOOR
            
            # 3단계: mid_y1 → mid_y2 (수직, mid_x 위치)
            for y in range(min(mid_y1, mid_y2), max(mid_y1, mid_y2) + 1):
                for dx in range(-half, half + 1):
                    nx = mid_x + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
            
            # 4단계: mid_x → cx2 (수평, mid_y2 높이)
            for x in range(min(mid_x, cx2), max(mid_x, cx2) + 1):
                for dy in range(-half, half + 1):
                    ny = mid_y2 + dy
                    if 0 <= ny < s and 0 <= x < s and map_array[ny, x] == Tile.VOID:
                        map_array[ny, x] = Tile.FLOOR
            
            # 5단계: mid_y2 → cy2 (수직)
            for y in range(min(mid_y2, cy2), max(mid_y2, cy2) + 1):
                for dx in range(-half, half + 1):
                    nx = cx2 + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
        
        elif dist_x > MAX_STRAIGHT:
            # 긴 수평 → Z자 (중간에 수직 이동)
            mid_x = (cx1 + cx2) // 2 + np.random.randint(-8, 9)
            offset_y = np.random.randint(5, 12) * (1 if np.random.random() < 0.5 else -1)
            mid_y = cy1 + offset_y
            mid_y = np.clip(mid_y, half + 1, s - half - 2)
            
            # cx1 → mid_x
            for x in range(min(cx1, mid_x), max(cx1, mid_x) + 1):
                for dy in range(-half, half + 1):
                    ny = cy1 + dy
                    if 0 <= ny < s and 0 <= x < s and map_array[ny, x] == Tile.VOID:
                        map_array[ny, x] = Tile.FLOOR
            
            # cy1 → mid_y
            for y in range(min(cy1, mid_y), max(cy1, mid_y) + 1):
                for dx in range(-half, half + 1):
                    nx = mid_x + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
            
            # mid_x → cx2
            for x in range(min(mid_x, cx2), max(mid_x, cx2) + 1):
                for dy in range(-half, half + 1):
                    ny = mid_y + dy
                    if 0 <= ny < s and 0 <= x < s and map_array[ny, x] == Tile.VOID:
                        map_array[ny, x] = Tile.FLOOR
            
            # mid_y → cy2
            for y in range(min(mid_y, cy2), max(mid_y, cy2) + 1):
                for dx in range(-half, half + 1):
                    nx = cx2 + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
        
        elif dist_y > MAX_STRAIGHT:
            # 긴 수직 → Z자 (중간에 수평 이동)
            mid_y = (cy1 + cy2) // 2 + np.random.randint(-8, 9)
            offset_x = np.random.randint(5, 12) * (1 if np.random.random() < 0.5 else -1)
            mid_x = cx1 + offset_x
            mid_x = np.clip(mid_x, half + 1, s - half - 2)
            
            # cy1 → mid_y
            for y in range(min(cy1, mid_y), max(cy1, mid_y) + 1):
                for dx in range(-half, half + 1):
                    nx = cx1 + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
            
            # cx1 → mid_x
            for x in range(min(cx1, mid_x), max(cx1, mid_x) + 1):
                for dy in range(-half, half + 1):
                    ny = mid_y + dy
                    if 0 <= ny < s and 0 <= x < s and map_array[ny, x] == Tile.VOID:
                        map_array[ny, x] = Tile.FLOOR
            
            # mid_y → cy2
            for y in range(min(mid_y, cy2), max(mid_y, cy2) + 1):
                for dx in range(-half, half + 1):
                    nx = mid_x + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
            
            # mid_x → cx2
            for x in range(min(mid_x, cx2), max(mid_x, cx2) + 1):
                for dy in range(-half, half + 1):
                    ny = cy2 + dy
                    if 0 <= ny < s and 0 <= x < s and map_array[ny, x] == Tile.VOID:
                        map_array[ny, x] = Tile.FLOOR
        
        else:
            # 짧은 거리: 기존 L자 연결
            # 수평 연결
            for x in range(min(cx1, cx2), max(cx1, cx2) + 1):
                for dy in range(-half, half + 1):
                    ny = cy1 + dy
                    if 0 <= ny < s and 0 <= x < s and map_array[ny, x] == Tile.VOID:
                        map_array[ny, x] = Tile.FLOOR
            
            # 수직 연결
            for y in range(min(cy1, cy2), max(cy1, cy2) + 1):
                for dx in range(-half, half + 1):
                    nx = cx2 + dx
                    if 0 <= y < s and 0 <= nx < s and map_array[y, nx] == Tile.VOID:
                        map_array[y, nx] = Tile.FLOOR
    
    @staticmethod
    def add_random_covers(map_array: np.ndarray, rooms: Dict):
        """
        방에 랜덤 커버 배치
        - 사이트: 커버 많이
        - 통로: 커버 적게
        """
        for name, room in rooms.items():
            if "SITE" in name.upper():
                count = np.random.randint(4, 8)
            elif any(k in name.upper() for k in ["MID", "LONG", "TUNNEL", "MAIN"]):
                count = np.random.randint(1, 4)
            else:
                count = np.random.randint(0, 3)
            
            for _ in range(count):
                if room['h'] <= 6 or room['w'] <= 6:
                    continue
                y = room['y'] + np.random.randint(3, room['h'] - 3)
                x = room['x'] + np.random.randint(3, room['w'] - 3)
                if map_array[y, x] == Tile.FLOOR:
                    map_array[y, x] = np.random.choice([
                        Tile.COVER_HALF, Tile.COVER_FULL, Tile.BOX
                    ])
    
    @staticmethod
    def generate_walls(map_array: np.ndarray):
        """
        바닥 타일 주변에 벽 생성
        """
        s = map_array.shape[0]
        new_map = map_array.copy()
        walkable = {Tile.FLOOR, Tile.COVER_HALF, Tile.COVER_FULL, Tile.BOX,
                   Tile.SITE_A, Tile.SITE_B, Tile.SPAWN_ATK, Tile.SPAWN_DEF, 
                   Tile.RAMP, Tile.PILLAR}
        
        for y in range(s):
            for x in range(s):
                if map_array[y, x] == Tile.VOID:
                    for dy in range(-1, 2):
                        for dx in range(-1, 2):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < s and 0 <= nx < s:
                                if map_array[ny, nx] in walkable:
                                    new_map[y, x] = Tile.WALL
                                    break
                        if new_map[y, x] == Tile.WALL:
                            break
        
        map_array[:] = new_map
    
    @staticmethod
    def remove_isolated_areas(map_array: np.ndarray, rooms: Dict):
        """
        고립된 영역(스폰에서 도달 불가능한 영역)을 제거합니다.
        ATK_SPAWN과 DEF_SPAWN에서 flood fill로 도달 가능한 영역만 유지.
        """
        from collections import deque
        
        s = map_array.shape[0]
        walkable = {Tile.FLOOR, Tile.COVER_HALF, Tile.COVER_FULL, Tile.BOX,
                   Tile.SITE_A, Tile.SITE_B, Tile.SPAWN_ATK, Tile.SPAWN_DEF, 
                   Tile.RAMP, Tile.PILLAR}
        
        # 시작점 찾기 (ATK_SPAWN 또는 DEF_SPAWN)
        start_points = []
        for name in ['ATK_SPAWN', 'DEF_SPAWN']:
            if name in rooms:
                room = rooms[name]
                cy = room['y'] + room['h'] // 2
                cx = room['x'] + room['w'] // 2
                if 0 <= cy < s and 0 <= cx < s:
                    start_points.append((cy, cx))
        
        if not start_points:
            # 스폰이 없으면 walkable 타일 중 아무거나
            for y in range(s):
                for x in range(s):
                    if map_array[y, x] in walkable:
                        start_points.append((y, x))
                        break
                if start_points:
                    break
        
        if not start_points:
            return  # 도달 가능한 영역 없음
        
        # BFS로 도달 가능한 영역 찾기
        reachable = set()
        queue = deque(start_points)
        
        while queue:
            y, x = queue.popleft()
            if (y, x) in reachable:
                continue
            if not (0 <= y < s and 0 <= x < s):
                continue
            if map_array[y, x] not in walkable:
                continue
            
            reachable.add((y, x))
            
            # 4방향 탐색
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if (ny, nx) not in reachable:
                    queue.append((ny, nx))
        
        # 도달 불가능한 walkable 영역을 VOID로 변환
        removed_count = 0
        for y in range(s):
            for x in range(s):
                if map_array[y, x] in walkable and (y, x) not in reachable:
                    map_array[y, x] = Tile.VOID
                    removed_count += 1
        
        if removed_count > 0:
            print(f"[DEBUG] Removed {removed_count} isolated tiles", flush=True)
