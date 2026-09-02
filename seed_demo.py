import os
import sys

# Delegate to backend.seed_demo
from backend.seed_demo import seed_initial_data

if __name__ == "__main__":
    seed_initial_data()
