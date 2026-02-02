"""
바인드 (Bind) - Valorant
Mid가 없는 독특한 구조
텔레포터로 빠른 로테이션
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class BindTemplate(MapTemplate):
    name = "Bind"
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
        
        # === Defender Spawn (상단) ===
        cls.create_room(m, rooms, "DEF_SPAWN", s//2 - 12, 8, 24, 16, Tile.SPAWN_DEF)
        
        # === A Site (좌측) ===
        cls.create_room(m, rooms, "A_SITE", 12, 15, 30, 30, Tile.SITE_A)
        cls.create_room(m, rooms, "A_SHORT", 15, s//2, 18, 25, None)
        cls.create_room(m, rooms, "A_LOBBY", 8, s - 50, 22, 22, None)
        cls.create_room(m, rooms, "SHOWERS", 35, 35, 15, 18, None)
        cls.create_room(m, rooms, "A_BATH", 10, 50, 15, 15, None)
        cls.create_room(m, rooms, "A_HEAVEN", 25, 8, 18, 12, None)
        cls.create_room(m, rooms, "A_LAMPS", 40, 20, 12, 15, None)
        
        # === B Site (우측) ===
        cls.create_room(m, rooms, "B_SITE", s - 42, 15, 30, 30, Tile.SITE_B)
        cls.create_room(m, rooms, "B_LONG", s - 30, s//2, 18, 35, None)
        cls.create_room(m, rooms, "B_LOBBY", s - 40, s - 50, 25, 22, None)
        cls.create_room(m, rooms, "HOOKAH", s - 45, 40, 18, 18, None)
        cls.create_room(m, rooms, "B_WINDOW", s - 25, 35, 12, 15, None)
        cls.create_room(m, rooms, "B_ELBOW", s - 35, s//2 + 15, 15, 18, None)
        cls.create_room(m, rooms, "B_GARDEN", s - 30, 10, 15, 12, None)
        
        # === 텔레포터 영역 (Bind 특징) ===
        cls.create_room(m, rooms, "TP_A", 45, s//2, 12, 12, None)  # A->B
        cls.create_room(m, rooms, "TP_B", s - 55, s//2 - 10, 12, 12, None)  # B->A
        
        # 연결
        connections = [
            # 공격 스폰
            ("ATK_SPAWN", "A_LOBBY", 5),
            ("ATK_SPAWN", "B_LOBBY", 5),
            
            # A 사이트
            ("A_LOBBY", "A_BATH", 4),
            ("A_BATH", "A_SHORT", 4),
            ("A_SHORT", "A_SITE", 5),
            ("A_SHORT", "SHOWERS", 4),
            ("SHOWERS", "A_SITE", 4),
            ("A_LAMPS", "A_SITE", 4),
            ("DEF_SPAWN", "A_HEAVEN", 4),
            ("A_HEAVEN", "A_SITE", 4),
            
            # B 사이트
            ("B_LOBBY", "B_LONG", 4),
            ("B_LONG", "B_ELBOW", 4),
            ("B_ELBOW", "B_SITE", 5),
            ("B_LOBBY", "HOOKAH", 4),
            ("HOOKAH", "B_WINDOW", 3),
            ("B_WINDOW", "B_SITE", 4),
            ("DEF_SPAWN", "B_GARDEN", 4),
            ("B_GARDEN", "B_SITE", 4),
            
            # 텔레포터 연결 (빠른 로테이션)
            ("A_SHORT", "TP_A", 3),
            ("TP_A", "B_LONG", 3),  # 텔레포터 효과
            ("HOOKAH", "TP_B", 3),
            ("TP_B", "A_LAMPS", 3),  # 텔레포터 효과
            
            # 수비 로테이션
            ("DEF_SPAWN", "SHOWERS", 4),
            ("DEF_SPAWN", "HOOKAH", 4),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
