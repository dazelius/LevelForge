"""
미라지 (Mirage) - Counter-Strike
Palace, Window/Connector, Underpass가 특징
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class MirageTemplate(MapTemplate):
    name = "Mirage"
    game = "Counter-Strike"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # T Spawn
        cls.create_room(m, rooms, "T_SPAWN", s//2 - 12, s - 25, 24, 18, Tile.SPAWN_ATK)
        
        # CT Spawn
        cls.create_room(m, rooms, "CT_SPAWN", s//2 - 12, 8, 24, 16, Tile.SPAWN_DEF)
        
        # A Site
        cls.create_room(m, rooms, "A_SITE", s - 38, 12, 30, 28, Tile.SITE_A)
        cls.create_room(m, rooms, "A_RAMP", s - 32, 42, 18, 20, None)
        cls.create_room(m, rooms, "PALACE", s - 25, s//2 + 10, 18, 25, None)
        cls.create_room(m, rooms, "A_MAIN", s - 40, s//2 + 25, 22, 20, None)
        cls.create_room(m, rooms, "TETRIS", s - 35, 25, 12, 12, None)
        cls.create_room(m, rooms, "STAIRS", s - 28, 8, 12, 10, None)
        
        # B Site
        cls.create_room(m, rooms, "B_SITE", 8, 12, 28, 26, Tile.SITE_B)
        cls.create_room(m, rooms, "B_APPS", 10, s//2 - 10, 15, 28, None)
        cls.create_room(m, rooms, "B_SHORT", 30, 30, 15, 18, None)
        cls.create_room(m, rooms, "MARKET", 35, 15, 18, 18, None)
        cls.create_room(m, rooms, "B_PLAT", 8, 8, 15, 10, None)
        
        # Mid
        cls.create_room(m, rooms, "MID", s//2 - 10, s//2 - 20, 20, 45, None)
        cls.create_room(m, rooms, "TOP_MID", s//2 - 8, 30, 16, 18, None)
        cls.create_room(m, rooms, "WINDOW", s//2 + 5, 35, 12, 12, None)
        cls.create_room(m, rooms, "CONNECTOR", s//2 + 10, 20, 15, 20, None)
        cls.create_room(m, rooms, "UNDERPASS", s//2 - 15, s//2 + 15, 12, 20, None)
        
        connections = [
            ("T_SPAWN", "A_MAIN", 5),
            ("T_SPAWN", "MID", 5),
            ("T_SPAWN", "B_APPS", 5),
            ("A_MAIN", "PALACE", 4),
            ("PALACE", "A_RAMP", 4),
            ("A_RAMP", "A_SITE", 5),
            ("TETRIS", "A_SITE", 4),
            ("CT_SPAWN", "STAIRS", 4),
            ("STAIRS", "A_SITE", 4),
            ("MID", "TOP_MID", 4),
            ("TOP_MID", "WINDOW", 3),
            ("WINDOW", "CONNECTOR", 3),
            ("CONNECTOR", "A_SITE", 4),
            ("TOP_MID", "CT_SPAWN", 4),
            ("B_APPS", "B_SITE", 5),
            ("B_SHORT", "B_SITE", 4),
            ("MARKET", "B_SITE", 4),
            ("CT_SPAWN", "MARKET", 4),
            ("MID", "UNDERPASS", 3),
            ("UNDERPASS", "B_SHORT", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
