"""GUI 控制器 (PySide6)：连接 UI 与重建流水线。

负责路径扫描、参数验证、后台线程管理。
"""
import sys
import threading
import traceback
from pathlib import Path

from PySide6.QtWidgets import QFileDialog, QMessageBox
from PySide6.QtCore import QObject, Signal, QThread

from core.ui import RecoWorker
from core import run1_488 as _recon


# ═══════════════════════════════════════════════════════════════
# stdout 重定向
# ═══════════════════════════════════════════════════════════════
class _LogRedirector:
    """将 stdout 逐行通过 Qt Signal 发送到 UI。"""

    def __init__(self, signal: Signal):
        self._signal = signal
        self._buf = ""

    def write(self, s: str):
        self._buf += s
        while '\n' in self._buf:
            line, self._buf = self._buf.split('\n', 1)
            if line.strip():
                self._signal.emit(line + '\n')

    def flush(self):
        if self._buf.strip():
            self._signal.emit(self._buf + '\n')
            self._buf = ""


# ═══════════════════════════════════════════════════════════════
# 辅助
# ═══════════════════════════════════════════════════════════════
def _find_raw_data_dirs(root: Path) -> list:
    found = []
    if not root.exists():
        return found
    for child in sorted(root.iterdir()):
        if not child.is_dir() or 'raw data' not in child.name.lower():
            continue
        dr = child / 'Dr'
        subs = sorted([d.name for d in dr.iterdir() if d.is_dir()]) if dr.exists() else []
        found.append({'name': child.name, 'path': child, 'dr_subdirs': subs})
    return found


def _resolve_data_root(path: Path) -> Path:
    return path.parent if 'raw data' in path.name.lower() else path


# ═══════════════════════════════════════════════════════════════
# 控制器
# ═══════════════════════════════════════════════════════════════
class Controller:

    def __init__(self, project_root: Path):
        self._root = project_root
        self._thread = None
        self._worker = None
        self.ui = None

    def init(self, ui):
        self.ui = ui
        self.ui.set_status("就绪 — 选择数据目录后点击「开始重建」")

    # ── 浏览 ──────────────────────────────────────────────────
    def on_browse(self):
        initial = self.ui.get_data_path() or str(self._root.parent)
        path = QFileDialog.getExistingDirectory(
            None, "选择数据根目录", initial)
        if not path:
            return
        self.ui.set_data_path(path)

        corrected = _resolve_data_root(Path(path))
        datasets = _find_raw_data_dirs(corrected)
        self.ui.show_datasets(datasets)

        if datasets:
            self.ui.set_status(
                f"已检测到 {len(datasets)} 个数据集 — 点击「开始重建」")
        else:
            self.ui.set_status(
                "⚠️  未检测到 raw data 子目录，请选择正确的上级目录")
            QMessageBox.warning(
                None, "警告",
                "所选目录下未找到 'raw data-*' 子目录。\n"
                "请选择上一级目录（例如 F3-live er 而非 raw data-live er）。")

    # ── 运行 ──────────────────────────────────────────────────
    def on_run(self):
        if self.ui._running:
            return

        raw = self.ui.get_data_path()
        if not raw:
            QMessageBox.critical(None, "错误", "请先选择数据目录")
            return

        path_obj = Path(raw)
        if not path_obj.exists():
            QMessageBox.critical(None, "错误", f"目录不存在:\n{raw}")
            return

        corrected = _resolve_data_root(path_obj)
        data_path = str(corrected)

        datasets = _find_raw_data_dirs(corrected)
        if not datasets:
            QMessageBox.critical(
                None, "错误",
                "未找到 'raw data-*' 子目录。\n请选择上一级目录。")
            return

        try:
            wiener = self.ui.get_wiener()
            if wiener <= 0:
                raise ValueError("Wiener 常数必须 > 0")
        except ValueError as e:
            QMessageBox.critical(None, "参数错误", str(e))
            return

        channel = self.ui.get_channel()
        loadflag = self.ui.get_loadflag()

        # 清空旧日志，写入概要
        self.ui._clear_log()
        self.ui.log("╔" + "═" * 50 + "╗\n")
        self.ui.log("║  " + "3D-MP-SIM 超分辨重建".center(48) + "║\n")
        self.ui.log("╠" + "═" * 50 + "╣\n")
        self.ui.log(f"║  数据根目录:  {data_path}".ljust(51) + "║\n")
        self.ui.log(f"║  Wiener:  {wiener}".ljust(51) + "║\n")
        self.ui.log(f"║  通道:  {channel} nm".ljust(51) + "║\n")
        for d in datasets:
            self.ui.log(f"║    - {d['name']}".ljust(51) + "║\n")
        self.ui.log("╚" + "═" * 50 + "╝\n\n")

        self.ui.set_running(True)

        # 创建信号载体
        self._worker = RecoWorker()
        self._worker.log_signal.connect(self.ui.log)
        self._worker.status_signal.connect(self.ui.set_status)
        self._worker.progress_signal.connect(self.ui._progress.setVisible)
        self._worker.finished_signal.connect(self._on_recon_done)

        # 启动后台线程
        self._thread = threading.Thread(
            target=self._run_in_thread,
            args=(data_path, wiener, channel, loadflag),
            daemon=True)
        self._thread.start()

    def _run_in_thread(self, data_path, wiener, channel, loadflag):
        """后台线程：执行重建，通过信号推送输出到 UI。"""
        old_stdout = sys.stdout
        sys.stdout = _LogRedirector(self._worker.log_signal)

        try:
            self._worker.status_signal.emit("重建进行中...")
            _recon.Run_recon(
                {'data_path': data_path, 'loadflag': loadflag},
                wiener, Channel=channel)
            self._worker.log_signal.emit("\n✅  重建成功完成\n")
            self._worker.finished_signal.emit(True, "重建完成")
        except Exception as e:
            tb = traceback.format_exc()
            self._worker.log_signal.emit(f"\n❌  错误: {e}\n\n{tb}\n")
            self._worker.finished_signal.emit(False, str(e))
        finally:
            sys.stdout = old_stdout

    def _on_recon_done(self, success: bool, message: str):
        """重建完成回调（主线程）。"""
        self.ui.set_running(False)
        if success:
            self.ui.set_status("重建完成")
        else:
            self.ui.set_status(f"错误: {message}")
            QMessageBox.critical(None, "重建出错", message)

    def shutdown(self):
        pass
