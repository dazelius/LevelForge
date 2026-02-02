"""
브리즈 (Breeze) - Valorant
넓고 개방적인 맵, A사이트가 특히 큼
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class BreezeTemplate(MapTemplate):
    name = "Breeze"
    game = "Valorant"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # Attacker Spawn
        cls.create_room(m, rooms, "ATK_SPAWN", s//2 - 12, s - 25, 24, 18, Tile.SPAWN_ATK)
        
        # Defender Spawn
        cls.create_room(m, rooms, "DEF_SPAWN", s//2 - 15, 5, 30, 15, Tile.SPAWN_DEF)
        
        # A Site (우측) - 브리즈 A는 크고 개방적
        cls.create_room(m, rooms, "A_SITE", s - 40, 18, 32, 30, Tile.SITE_A)
        cls.create_room(m, rooms, "A_HALL", s - 35, 50, 18, 25, None)
        cls.create_room(m, rooms, "A_LOBBY", s - 40, s - 50, 25, 22, None)
        cls.create_room(m, rooms, "A_SHOP", s - 28, s//2 + 10, 15, 15, None)
        cls.create_room(m, rooms, "A_CAVE", s - 18, 25, 12, 15, None)
        
        # B Site (좌측)
        cls.create_room(m, rooms, "B_SITE", 8, 18, 28, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", 15, s//2, 18, 25, None)
        cls.create_room(m, rooms, "B_TUNNEL", 5, s//2 + 20, 12, 30, None)
        cls.create_room(m, rooms, "B_ELBOW", 30, 35, 15, 15, None)
        cls.create_room(m, rooms, "B_BACK", 5, 10, 15, 15, None)
        
        # Mid
        cls.create_room(m, rooms, "MID", s//2 - 10, s//2 - 15, 20, 35, None)
        cls.create_room(m, rooms, "MID_NEST", s//2 - 8, 25, 16, 18, None)
        cls.create_room(m, rooms, "MID_WOOD", s//2 + 5, s//2, 12, 15, None)
        
        # 연결
        connections = [
            ("ATK_SPAWN", "A_LOBBY", 5),
            ("ATK_SPAWN", "MID", 5),
            ("ATK_SPAWN", "B_TUNNEL", 5),
            ("A_LOBBY", "A_HALL", 4),
            ("A_HALL", "A_SITE", 5),
            ("A_SHOP", "A_SITE", 4),
            ("A_CAVE", "A_SITE", 3),
            ("DEF_SPAWN", "A_SITE", 4),
            ("MID", "MID_NEST", 4),
            ("MID_NEST", "DEF_SPAWN", 4),
            ("MID", "MID_WOOD", 4),
            ("MID_WOOD", "A_HALL", 3),
            ("B_TUNNEL", "B_MAIN", 4),
            ("B_MAIN", "B_SITE", 5),
            ("B_ELBOW", "B_SITE", 4),
            ("DEF_SPAWN", "B_SITE", 4),
            ("B_BACK", "B_SITE", 3),
            ("MID_NEST", "B_ELBOW", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
