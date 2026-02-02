"""
헤이븐 (Haven) - Valorant
유일한 3사이트 맵 (A, B, C)
수비 로테이션이 핵심
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class HavenTemplate(MapTemplate):
    name = "Haven"
    game = "Valorant"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # === Attack Spawn (하단) ===
        cls.create_room(m, rooms, "ATK_SPAWN", s//2 - 15, s - 28, 30, 20, Tile.SPAWN_ATK)
        
        # === Defender Spawn (상단 중앙) ===
        cls.create_room(m, rooms, "DEF_SPAWN", s//2 - 12, 8, 24, 18, Tile.SPAWN_DEF)
        
        # === A Site (좌측 상단) ===
        cls.create_room(m, rooms, "A_SITE", 8, 15, 28, 26, Tile.SITE_A)
        cls.create_room(m, rooms, "A_LONG", 10, 45, 15, 35, None)
        cls.create_room(m, rooms, "A_SHORT", 25, 35, 18, 18, None)
        cls.create_room(m, rooms, "A_LOBBY", 8, s - 50, 20, 20, None)
        cls.create_room(m, rooms, "SEWERS", 5, s//2 + 10, 12, 25, None)
        cls.create_room(m, rooms, "A_HEAVEN", 15, 8, 15, 12, None)
        
        # === B Site (중앙 - 가장 빠른 사이트) ===
        cls.create_room(m, rooms, "B_SITE", s//2 - 14, 20, 28, 26, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", s//2 - 10, s//2, 20, 25, None)
        cls.create_room(m, rooms, "GARAGE", s//2 - 18, s - 45, 22, 18, None)
        cls.create_room(m, rooms, "MID_WINDOW", s//2 + 8, 35, 12, 15, None)
        cls.create_room(m, rooms, "MID_DOORS", s//2 - 5, s//2 + 20, 15, 15, None)
        
        # === C Site (우측 상단) ===
        # Haven의 C사이트 (3번째 사이트)
        cls.create_room(m, rooms, "C_SITE", s - 38, 15, 28, 26, Tile.SITE_A)  # SITE_A 재사용
        cls.create_room(m, rooms, "C_LONG", s - 25, 45, 15, 40, None)
        cls.create_room(m, rooms, "C_LOBBY", s - 35, s - 50, 22, 20, None)
        cls.create_room(m, rooms, "C_CUBBY", s - 20, 35, 12, 15, None)
        cls.create_room(m, rooms, "C_HEAVEN", s - 28, 8, 15, 12, None)
        
        # 연결
        connections = [
            # 공격 스폰
            ("ATK_SPAWN", "A_LOBBY", 5),
            ("ATK_SPAWN", "GARAGE", 5),
            ("ATK_SPAWN", "C_LOBBY", 5),
            
            # A 사이트
            ("A_LOBBY", "SEWERS", 4),
            ("SEWERS", "A_LONG", 4),
            ("A_LONG", "A_SHORT", 4),
            ("A_SHORT", "A_SITE", 5),
            ("A_LOBBY", "A_LONG", 4),
            ("DEF_SPAWN", "A_HEAVEN", 4),
            ("A_HEAVEN", "A_SITE", 4),
            
            # B 사이트
            ("GARAGE", "MID_DOORS", 4),
            ("MID_DOORS", "B_MAIN", 4),
            ("B_MAIN", "B_SITE", 5),
            ("MID_WINDOW", "B_SITE", 3),
            ("DEF_SPAWN", "B_SITE", 4),
            
            # C 사이트
            ("C_LOBBY", "C_LONG", 4),
            ("C_LONG", "C_CUBBY", 4),
            ("C_CUBBY", "C_SITE", 5),
            ("DEF_SPAWN", "C_HEAVEN", 4),
            ("C_HEAVEN", "C_SITE", 4),
            
            # 로테이션
            ("A_SHORT", "MID_WINDOW", 3),
            ("B_SITE", "MID_WINDOW", 3),
            ("DEF_SPAWN", "MID_WINDOW", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
