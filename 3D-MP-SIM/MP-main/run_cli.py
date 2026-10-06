"""无 UI 命令行直接重建（调试用）。"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / 'core'))

from core.run1_488 import Run_recon

# === 配置 ===
DATA_PATH = "/Users/22p/Documents/数据集/F3-live er"
WIENER    = 1e-4
CHANNEL   = 488
LOADFLAG  = 5       # 5 = 优先加载已有参数，没有则重新估计

print(f"数据目录: {DATA_PATH}")
print(f"Wiener: {WIENER}")
print(f"通道: {CHANNEL}nm")
print(f"LoadFlag: {LOADFLAG}")
print(f"OTF 目录: {PROJECT_ROOT / 'OTF'}")
print("-" * 50)

Run_recon(
    {'data_path': DATA_PATH, 'loadflag': LOADFLAG},
    WIENER, Channel=CHANNEL
)
