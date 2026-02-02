"""
펄 (Pearl) - Valorant
클래식한 3레인 구조
Mid가 넓고 중요함
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class PearlTemplate(MapTemplate):
    name = "Pearl"
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
        cls.create_room(m, rooms, "A_SITE", 12, 18, 30, 28, Tile.SITE_A)
        cls.create_room(m, rooms, "A_MAIN", 15, s//2 + 5, 18, 30, None)
        cls.create_room(m, rooms, "A_LOBBY", 8, s - 48, 22, 20, None)
        cls.create_room(m, rooms, "A_ART", 35, 30, 15, 18, None)
        cls.create_room(m, rooms, "A_DUGOUT", 25, 12, 15, 12, None)
        cls.create_room(m, rooms, "A_SECRET", 10, 40, 12, 15, None)
        cls.create_room(m, rooms, "A_FLOWERS", 30, 45, 12, 12, None)
        
        # === B Site (우측) ===
        cls.create_room(m, rooms, "B_SITE", s - 42, 18, 30, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", s - 35, s//2 + 10, 20, 28, None)
        cls.create_room(m, rooms, "B_LOBBY", s - 40, s - 48, 25, 20, None)
        cls.create_room(m, rooms, "B_RAMP", s - 45, 40, 18, 18, None)
        cls.create_room(m, rooms, "B_TOWER", s - 30, 12, 15, 12, None)
        cls.create_room(m, rooms, "B_HALL", s - 25, 35, 12, 18, None)
        cls.create_room(m, rooms, "B_SCREEN", s - 35, s//2, 15, 15, None)
        
        # === Mid (넓음) ===
        cls.create_room(m, rooms, "MID", s//2 - 12, s//2 - 15, 24, 35, None)
        cls.create_room(m, rooms, "MID_TOP", s//2 - 8, 28, 16, 18, None)
        cls.create_room(m, rooms, "MID_SHOPS", s//2 + 8, s//2, 15, 18, None)
        cls.create_room(m, rooms, "MID_PLAZA", s//2 - 15, s - 50, 22, 18, None)
        cls.create_room(m, rooms, "MID_CONN", s//2 - 5, s//2 + 20, 12, 15, None)
        
        connections = [
            ("ATK_SPAWN", "A_LOBBY", 5),
            ("ATK_SPAWN", "MID_PLAZA", 5),
            ("ATK_SPAWN", "B_LOBBY", 5),
            ("A_LOBBY", "A_MAIN", 4),
            ("A_MAIN", "A_FLOWERS", 4),
            ("A_FLOWERS", "A_ART", 3),
            ("A_ART", "A_SITE", 5),
            ("A_SECRET", "A_SITE", 4),
            ("DEF_SPAWN", "A_DUGOUT", 4),
            ("A_DUGOUT", "A_SITE", 4),
            ("MID_PLAZA", "MID_CONN", 4),
            ("MID_CONN", "MID", 4),
            ("MID", "MID_TOP", 4),
            ("MID_TOP", "A_ART", 3),
            ("MID", "MID_SHOPS", 4),
            ("MID_SHOPS", "B_RAMP", 3),
            ("B_LOBBY", "B_MAIN", 4),
            ("B_MAIN", "B_SCREEN", 4),
            ("B_SCREEN", "B_RAMP", 4),
            ("B_RAMP", "B_SITE", 5),
            ("B_HALL", "B_SITE", 4),
            ("DEF_SPAWN", "B_TOWER", 4),
            ("B_TOWER", "B_SITE", 4),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
