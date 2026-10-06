"""3D-MP-SIM 主界面入口 (PySide6)

自动定位项目根目录并启动 Qt GUI。
"""
import sys
import locale
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
CORE_DIR = str(PROJECT_ROOT / 'core')
if CORE_DIR not in sys.path:
    sys.path.insert(0, CORE_DIR)


def main():
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')

    from PySide6.QtWidgets import QApplication
    from core.ui import MainWindow
    from core.control import Controller

    app = QApplication(sys.argv)
    app.setApplicationName("3D-MP-SIM")

    controller = Controller(project_root=PROJECT_ROOT)
    window = MainWindow(controller)
    window.show()

    # macOS 上确保 Dock 图标和应用菜单正常工作
    app.setQuitOnLastWindowClosed(True)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
