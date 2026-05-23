#!/usr/bin/env python3
import os
import sys
import json
import platform

def get_system_health():
    try:
        health = {
            "os": platform.system(),
            "release": platform.release(),
            "cpu_cores": os.cpu_count()
        }
        print(json.dumps(health))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    get_system_health()
