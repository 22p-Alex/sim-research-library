"""3D-MP-SIM 图形用户界面 (PySide6)

现代化 Qt 界面：卡片式布局、深色日志区域、实时进度反馈。
"""
from datetime import datetime

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QComboBox, QTextEdit,
    QProgressBar, QFrame, QSizePolicy, QGroupBox, QMessageBox
)
from PySide6.QtCore import Qt, Signal, QThread, QObject, Slot
from PySide6.QtGui import QFont, QColor, QPalette, QIcon, QTextCursor

# ── 色彩常量 ──────────────────────────────────────────────
C_BG         = '#f0f2f5'
C_CARD_BG    = '#ffffff'
C_ACCENT     = '#2563eb'
C_ACCENT_HOV = '#1d4ed8'
C_DANGER     = '#dc2626'
C_SUCCESS    = '#16a34a'
C_WARN        = '#f59e0b'
C_TEXT       = '#1e293b'
C_TEXT_DIM   = '#64748b'
C_BORDER     = '#d1d5db'
C_LOG_BG     = '#1e1e2e'
C_LOG_FG     = '#cdd6f4'
FONT         = 'SF Pro Display, Helvetica Neue, sans-serif'
FONT_MONO    = 'JetBrains Mono, Menlo, monospace'


# ═══════════════════════════════════════════════════════════════
# 信号载体（跨线程通信）
# ═══════════════════════════════════════════════════════════════
class RecoWorker(QObject):
    """后台重建线程的信号发射器。"""

    log_signal      = Signal(str)     # 日志消息
    status_signal   = Signal(str)     # 状态栏文本
    progress_signal = Signal(bool)    # True=开始动画, False=停止
    finished_signal = Signal(bool, str)  # (成功?, 消息)


# ═══════════════════════════════════════════════════════════════
# 主窗口
# ═══════════════════════════════════════════════════════════════
class MainWindow(QMainWindow):
    """3D-MP-SIM 主窗口。"""

    def __init__(self, controller):
        super().__init__()
        self.ctl = controller
        self._running = False

        self._setup_ui()
        self._connect_signals()
        self.ctl.init(self)

    # ── UI 搭建 ────────────────────────────────────────────────
    def _setup_ui(self):
        self.setWindowTitle("3D-MP-SIM Reconstruction")
        self.setMinimumSize(720, 620)
        self.resize(780, 660)
        self.setStyleSheet(f"""
            QMainWindow {{ background-color: {C_BG}; }}
            QGroupBox {{
                background-color: {C_CARD_BG};
                border: 1px solid {C_BORDER};
                border-radius: 6px;
                margin-top: 14px;
                padding: 16px;
                font: 12px "{FONT}";
                font-weight: bold;
                color: {C_TEXT};
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 6px;
            }}
            QLineEdit {{
                border: 1px solid {C_BORDER};
                border-radius: 4px;
                padding: 6px 10px;
                font: 13px "{FONT}";
                color: {C_TEXT};
                background: {C_CARD_BG};
            }}
            QLineEdit:focus {{ border-color: {C_ACCENT}; }}
            QComboBox {{
                border: 1px solid {C_BORDER};
                border-radius: 4px;
                padding: 5px 8px;
                font: 12px "{FONT}";
                color: {C_TEXT};
                background: {C_CARD_BG};
            }}
            QPushButton#browseBtn {{
                border: 1px solid {C_BORDER};
                border-radius: 4px;
                padding: 6px 16px;
                font: 12px "{FONT}";
                color: {C_TEXT};
                background: {C_CARD_BG};
            }}
            QPushButton#browseBtn:hover {{ background: #e8eaed; }}
            QPushButton#runBtn {{
                border: none;
                border-radius: 5px;
                padding: 10px 28px;
                font: 13px "{FONT}";
                font-weight: bold;
                color: white;
                background-color: {C_ACCENT};
            }}
            QPushButton#runBtn:hover {{ background-color: {C_ACCENT_HOV}; }}
            QPushButton#runBtn:disabled {{
                background-color: #94a3b8;
                color: #e2e8f0;
            }}
            QPushButton#clearBtn {{
                border: 1px solid {C_BORDER};
                border-radius: 5px;
                padding: 8px 18px;
                font: 12px "{FONT}";
                color: {C_TEXT_DIM};
                background: {C_CARD_BG};
            }}
            QPushButton#clearBtn:hover {{ background: #e8eaed; }}
            QProgressBar {{
                border: none;
                border-radius: 3px;
                background: #e2e8f0;
                height: 6px;
                text-align: center;
            }}
            QProgressBar::chunk {{
                background-color: {C_ACCENT};
                border-radius: 3px;
            }}
        """)

        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(16, 16, 16, 16)
        root.setSpacing(10)

        # ── 头部 ──
        header = QFrame()
        header.setFixedHeight(48)
        header.setStyleSheet(
            f"background-color: {C_ACCENT}; border-radius: 6px;")
        hl = QHBoxLayout(header)
        hl.setContentsMargins(20, 0, 20, 0)
        title = QLabel("🧬  3D-MP-SIM 超分辨重建")
        title.setFont(QFont(FONT, 16, QFont.Bold))
        title.setStyleSheet("color: white;")
        hl.addWidget(title)
        hl.addStretch()
        ver = QLabel("v2.0")
        ver.setStyleSheet("color: #93c5fd; font: 11px;")
        hl.addWidget(ver)
        root.addWidget(header)

        # ── 数据卡片 ──
        data_card = QGroupBox("📂  数据目录")
        dl = QVBoxLayout(data_card)
        dl.setSpacing(6)
        row1 = QHBoxLayout()
        self._path_edit = QLineEdit()
        self._path_edit.setPlaceholderText("选择包含 raw data-* 子目录的根路径...")
        row1.addWidget(self._path_edit)
        self._browse_btn = QPushButton("浏览...")
        self._browse_btn.setObjectName("browseBtn")
        row1.addWidget(self._browse_btn)
        dl.addLayout(row1)
        self._dataset_label = QLabel()
        self._dataset_label.setFont(QFont(FONT, 10))
        self._dataset_label.setStyleSheet(f"color: {C_TEXT_DIM}; background: transparent;")
        self._dataset_label.setWordWrap(True)
        dl.addWidget(self._dataset_label)
        root.addWidget(data_card)

        # ── 参数卡片 ──
        param_card = QGroupBox("⚙️  重建参数")
        pl = QHBoxLayout(param_card)
        pl.setSpacing(10)

        pl.addWidget(self._param_label("Wiener 常数"))
        self._wiener_edit = QLineEdit("1e-4")
        self._wiener_edit.setFixedWidth(80)
        self._wiener_edit.setAlignment(Qt.AlignCenter)
        pl.addWidget(self._wiener_edit)
        pl.addSpacing(16)

        pl.addWidget(self._param_label("通道"))
        self._channel_combo = QComboBox()
        self._channel_combo.addItems(["488", "561"])
        self._channel_combo.setFixedWidth(72)
        pl.addWidget(self._channel_combo)
        pl.addSpacing(16)

        pl.addWidget(self._param_label("Load Flag"))
        self._loadflag_combo = QComboBox()
        self._loadflag_combo.addItems(["0", "1", "3", "4", "5"])
        self._loadflag_combo.setCurrentText("5")
        self._loadflag_combo.setFixedWidth(60)
        pl.addWidget(self._loadflag_combo)
        pl.addStretch()
        root.addWidget(param_card)

        # ── 操作按钮 ──
        btn_row = QHBoxLayout()
        self._run_btn = QPushButton("▶  开始重建")
        self._run_btn.setObjectName("runBtn")
        btn_row.addWidget(self._run_btn)
        self._clear_btn = QPushButton("清空日志")
        self._clear_btn.setObjectName("clearBtn")
        btn_row.addWidget(self._clear_btn)
        btn_row.addStretch()
        root.addLayout(btn_row)

        # ── 日志区 ──
        log_group = QGroupBox("📋  运行日志")
        log_layout = QVBoxLayout(log_group)
        log_layout.setContentsMargins(4, 4, 4, 4)
        self._log_text = QTextEdit()
        self._log_text.setReadOnly(True)
        self._log_text.setFont(QFont(FONT_MONO, 10))
        self._log_text.setStyleSheet(f"""
            background-color: {C_LOG_BG};
            color: {C_LOG_FG};
            border: none;
            border-radius: 4px;
            padding: 8px;
        """)
        log_layout.addWidget(self._log_text)
        root.addWidget(log_group, stretch=1)

        # ── 底部状态栏 ──
        status_widget = QWidget()
        status_widget.setFixedHeight(32)
        sl = QHBoxLayout(status_widget)
        sl.setContentsMargins(4, 0, 4, 0)
        self._progress = QProgressBar()
        self._progress.setRange(0, 0)  # 不确定模式
        self._progress.setFixedWidth(180)
        self._progress.hide()
        sl.addWidget(self._progress)
        sl.addSpacing(10)
        self._status_label = QLabel("就绪 — 选择数据目录后点击「开始重建」")
        self._status_label.setFont(QFont(FONT, 10))
        self._status_label.setStyleSheet(f"color: {C_TEXT_DIM};")
        sl.addWidget(self._status_label, stretch=1)
        root.addWidget(status_widget)

    def _param_label(self, text):
        lbl = QLabel(text)
        lbl.setFont(QFont(FONT, 10))
        lbl.setStyleSheet(f"color: {C_TEXT_DIM}; background: transparent;")
        return lbl

    # ── 信号连接 ──────────────────────────────────────────────
    def _connect_signals(self):
        self._browse_btn.clicked.connect(self.ctl.on_browse)
        self._run_btn.clicked.connect(self.ctl.on_run)
        self._clear_btn.clicked.connect(self._clear_log)

    # ── 公共接口（控制器调用）─────────────────────────────────
    def get_data_path(self) -> str:
        return self._path_edit.text().strip()

    def set_data_path(self, path: str):
        self._path_edit.setText(path)

    def get_wiener(self) -> float:
        try:
            return float(self._wiener_edit.text())
        except ValueError:
            return 1e-4

    def get_channel(self) -> int:
        try:
            return int(self._channel_combo.currentText())
        except ValueError:
            return 488

    def get_loadflag(self) -> int:
        try:
            return int(self._loadflag_combo.currentText())
        except ValueError:
            return 5

    def show_datasets(self, datasets: list):
        if not datasets:
            self._dataset_label.setText(
                "⚠️  未检测到 'raw data-*' 子目录")
            self._dataset_label.setStyleSheet(
                f"color: {C_DANGER}; font: 10px;")
            return
        lines = []
        for d in datasets:
            dr_info = (f"  (Dr: {', '.join(d['dr_subdirs'])})"
                       if d['dr_subdirs'] else "")
            lines.append(f"●  {d['name']}{dr_info}")
        self._dataset_label.setText("\n".join(lines))
        self._dataset_label.setStyleSheet(
            f"color: {C_SUCCESS}; font: 10px;")

    def set_status(self, text: str):
        self._status_label.setText(text)

    def log(self, text: str):
        ts = datetime.now().strftime('%H:%M:%S')
        # 仅对有内容的行加时间戳
        for line in text.splitlines(True):
            if line.strip():
                self._log_text.append(f"<span style='color:#6c7086;'>[{ts}]</span> {line}")
            else:
                self._log_text.append(line)
        # 滚动到底部
        cursor = self._log_text.textCursor()
        cursor.movePosition(QTextCursor.End)
        self._log_text.setTextCursor(cursor)

    def _clear_log(self):
        self._log_text.clear()

    def set_running(self, running: bool):
        self._running = running
        enabled = not running
        self._browse_btn.setEnabled(enabled)
        self._path_edit.setEnabled(enabled)
        self._wiener_edit.setEnabled(enabled)
        self._channel_combo.setEnabled(enabled)
        self._loadflag_combo.setEnabled(enabled)
        self._run_btn.setEnabled(enabled)
        self._run_btn.setText("⏳  重建中..." if running else "▶  开始重建")
        self._progress.setVisible(running)
        self._status_label.setText("重建进行中..." if running else "就绪")
