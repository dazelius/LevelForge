"""
스플릿 (Split) - Valorant
수직 구조, 로프 많음
Mid가 좁고 위험함
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class SplitTemplate(MapTemplate):
    name = "Split"
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
        cls.create_room(m, rooms, "DEF_SPAWN", s//2 - 12, 8, 24, 16, Tile.SPAWN_DEF)
        
        # === A Site (좌측 상단) ===
        cls.create_room(m, rooms, "A_SITE", 15, 15, 28, 28, Tile.SITE_A)
        cls.create_room(m, rooms, "A_MAIN", 12, s//2, 18, 28, None)
        cls.create_room(m, rooms, "A_LOBBY", 8, s - 45, 22, 18, None)
        cls.create_room(m, rooms, "A_RAMP", 25, 45, 15, 20, None)
        cls.create_room(m, rooms, "A_HEAVEN", 20, 8, 18, 12, None)
        cls.create_room(m, rooms, "A_SCREENS", 35, 25, 12, 15, None)
        cls.create_room(m, rooms, "A_RAFTERS", 15, 35, 12, 12, None)
        
        # === B Site (우측 상단) ===
        cls.create_room(m, rooms, "B_SITE", s - 43, 15, 28, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", s - 35, s//2, 18, 28, None)
        cls.create_room(m, rooms, "B_LOBBY", s - 38, s - 45, 22, 18, None)
        cls.create_room(m, rooms, "B_HEAVEN", s - 35, 8, 18, 12, None)
        cls.create_room(m, rooms, "B_TOWER", s - 28, 40, 12, 15, None)
        cls.create_room(m, rooms, "B_BACK", s - 25, 25, 12, 15, None)
        cls.create_room(m, rooms, "B_GARAGE", s - 45, s//2 + 20, 18, 15, None)
        
        # === Mid (좁고 위험) ===
        cls.create_room(m, rooms, "MID", s//2 - 8, s//2 - 10, 16, 30, None)
        cls.create_room(m, rooms, "MID_VENT", s//2 - 5, 35, 10, 12, None)
        cls.create_room(m, rooms, "MID_MAIL", s//2 + 5, s//2, 12, 15, None)
        cls.create_room(m, rooms, "MID_BOTTOM", s//2 - 10, s - 50, 20, 18, None)
        
        connections = [
            ("ATK_SPAWN", "A_LOBBY", 5),
            ("ATK_SPAWN", "MID_BOTTOM", 4),
            ("ATK_SPAWN", "B_LOBBY", 5),
            ("A_LOBBY", "A_MAIN", 4),
            ("A_MAIN", "A_RAMP", 4),
            ("A_RAMP", "A_SITE", 5),
            ("A_MAIN", "A_RAFTERS", 3),
            ("A_SCREENS", "A_SITE", 4),
            ("DEF_SPAWN", "A_HEAVEN", 4),
            ("A_HEAVEN", "A_SITE", 4),
            ("MID_BOTTOM", "MID", 4),
            ("MID", "MID_VENT", 3),
            ("MID_VENT", "A_SCREENS", 3),
            ("MID", "MID_MAIL", 3),
            ("MID_MAIL", "B_TOWER", 3),
            ("B_LOBBY", "B_GARAGE", 4),
            ("B_GARAGE", "B_MAIN", 4),
            ("B_MAIN", "B_TOWER", 4),
            ("B_TOWER", "B_SITE", 5),
            ("B_BACK", "B_SITE", 4),
            ("DEF_SPAWN", "B_HEAVEN", 4),
            ("B_HEAVEN", "B_SITE", 4),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
