"""
오버패스 (Overpass) - Counter-Strike
넓은 야외 공간, 다층 구조
A Long이 매우 김
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class OverpassTemplate(MapTemplate):
    name = "Overpass"
    game = "Counter-Strike"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # === T Spawn (좌측 하단) ===
        cls.create_room(m, rooms, "T_SPAWN", 8, s - 30, 25, 22, Tile.SPAWN_ATK)
        
        # === CT Spawn (우측 상단) ===
        cls.create_room(m, rooms, "CT_SPAWN", s - 35, 8, 25, 18, Tile.SPAWN_DEF)
        
        # === A Site (우측) ===
        cls.create_room(m, rooms, "A_SITE", s - 40, s//2 - 15, 30, 30, Tile.SITE_A)
        cls.create_room(m, rooms, "A_LONG", s//2, s - 45, 20, 50, None)  # 긴 통로
        cls.create_room(m, rooms, "TOILETS", s - 35, s//2 + 20, 18, 18, None)
        cls.create_room(m, rooms, "BANK", s - 30, 30, 18, 18, None)
        cls.create_room(m, rooms, "TRUCK", s - 25, s//2 - 5, 12, 15, None)
        cls.create_room(m, rooms, "PARTY", s - 45, s//2 + 5, 15, 15, None)
        
        # === B Site (좌측 상단) ===
        cls.create_room(m, rooms, "B_SITE", 15, 15, 30, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_SHORT", 40, 35, 20, 20, None)
        cls.create_room(m, rooms, "CONNECTOR", s//2, s//2 - 15, 18, 25, None)
        cls.create_room(m, rooms, "MONSTER", 8, 45, 15, 25, None)
        cls.create_room(m, rooms, "HEAVEN", 20, 8, 15, 12, None)
        cls.create_room(m, rooms, "WATER", 35, 15, 15, 18, None)
        cls.create_room(m, rooms, "PILLAR", 45, 20, 12, 12, None)
        
        # === Mid ===
        cls.create_room(m, rooms, "PLAYGROUND", 25, s//2, 22, 22, None)
        cls.create_room(m, rooms, "FOUNTAIN", s//2 - 15, s//2 + 15, 18, 20, None)
        cls.create_room(m, rooms, "T_CONN", 20, s - 50, 18, 18, None)
        
        # 연결
        connections = [
            # T 스폰
            ("T_SPAWN", "T_CONN", 4),
            ("T_SPAWN", "MONSTER", 4),
            ("T_CONN", "A_LONG", 4),
            ("T_CONN", "PLAYGROUND", 4),
            
            # A 사이트
            ("A_LONG", "TOILETS", 4),
            ("TOILETS", "A_SITE", 5),
            ("A_LONG", "PARTY", 3),
            ("PARTY", "A_SITE", 4),
            ("BANK", "A_SITE", 4),
            ("CT_SPAWN", "BANK", 4),
            ("TRUCK", "A_SITE", 3),
            
            # Mid / Connector
            ("PLAYGROUND", "FOUNTAIN", 4),
            ("FOUNTAIN", "CONNECTOR", 4),
            ("CONNECTOR", "B_SHORT", 4),
            ("CONNECTOR", "A_SITE", 4),
            
            # B 사이트
            ("MONSTER", "B_SITE", 4),
            ("B_SHORT", "PILLAR", 3),
            ("PILLAR", "B_SITE", 4),
            ("WATER", "B_SITE", 4),
            ("CT_SPAWN", "HEAVEN", 4),
            ("HEAVEN", "B_SITE", 4),
            
            # 수비 로테이션
            ("CT_SPAWN", "CONNECTOR", 4),
            ("BANK", "CONNECTOR", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
