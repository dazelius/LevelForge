"""
아이스박스 (Icebox) - Valorant
수직 구조 극대화, 로프/줄 많음
B사이트 Yellow/Green 구조
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class IceboxTemplate(MapTemplate):
    name = "Icebox"
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
        cls.create_room(m, rooms, "DEF_SPAWN", s//2 - 12, 5, 24, 16, Tile.SPAWN_DEF)
        
        # === A Site (좌측) ===
        cls.create_room(m, rooms, "A_SITE", 12, 20, 30, 30, Tile.SITE_A)
        cls.create_room(m, rooms, "A_MAIN", 15, s//2 + 5, 18, 30, None)
        cls.create_room(m, rooms, "A_BELT", 8, s - 45, 20, 18, None)
        cls.create_room(m, rooms, "A_PIPES", 35, 35, 15, 18, None)
        cls.create_room(m, rooms, "A_NEST", 25, 15, 15, 12, None)
        cls.create_room(m, rooms, "A_SCREENS", 10, 45, 12, 15, None)
        cls.create_room(m, rooms, "A_RAFTERS", 30, 25, 12, 12, None)
        
        # === B Site (우측) ===
        cls.create_room(m, rooms, "B_SITE", s - 42, 20, 30, 30, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", s - 35, s//2 + 10, 20, 25, None)
        cls.create_room(m, rooms, "B_LOBBY", s - 40, s - 45, 25, 18, None)
        cls.create_room(m, rooms, "B_YELLOW", s - 35, 35, 15, 18, None)
        cls.create_room(m, rooms, "B_GREEN", s - 25, 25, 12, 15, None)
        cls.create_room(m, rooms, "B_ORANGE", s - 45, 25, 15, 15, None)
        cls.create_room(m, rooms, "B_KITCHEN", s - 30, s//2, 15, 15, None)
        
        # === Mid ===
        cls.create_room(m, rooms, "MID", s//2 - 10, s//2 - 10, 20, 30, None)
        cls.create_room(m, rooms, "MID_TUBE", s//2, 30, 12, 18, None)
        cls.create_room(m, rooms, "MID_BOILER", s//2 - 15, s//2 + 15, 15, 15, None)
        cls.create_room(m, rooms, "UNDERPASS", s//2 - 8, s - 50, 16, 18, None)
        
        connections = [
            ("ATK_SPAWN", "A_BELT", 5),
            ("ATK_SPAWN", "UNDERPASS", 4),
            ("ATK_SPAWN", "B_LOBBY", 5),
            ("A_BELT", "A_SCREENS", 4),
            ("A_SCREENS", "A_MAIN", 4),
            ("A_MAIN", "A_SITE", 5),
            ("A_PIPES", "A_SITE", 4),
            ("A_RAFTERS", "A_SITE", 3),
            ("DEF_SPAWN", "A_NEST", 4),
            ("A_NEST", "A_SITE", 4),
            ("UNDERPASS", "MID_BOILER", 3),
            ("MID_BOILER", "MID", 4),
            ("MID", "MID_TUBE", 3),
            ("MID_TUBE", "A_PIPES", 3),
            ("MID", "B_KITCHEN", 3),
            ("B_LOBBY", "B_MAIN", 4),
            ("B_MAIN", "B_KITCHEN", 4),
            ("B_KITCHEN", "B_YELLOW", 4),
            ("B_YELLOW", "B_SITE", 5),
            ("B_GREEN", "B_SITE", 4),
            ("B_ORANGE", "B_SITE", 4),
            ("DEF_SPAWN", "B_ORANGE", 4),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
