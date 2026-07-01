# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 打包配置 - 电商经营驾驶舱 Pro
================================
打包命令:
    pyinstaller build.spec

产物:
    dist/电商经营驾驶舱Pro/电商经营驾驶舱Pro.exe
"""

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=[
        # 包含 ECharts 资源（如果有本地 echarts.min.js）
        # ('app/ui/resources/echarts/*', 'app/ui/resources/echarts'),
    ],
    hiddenimports=[
        'PySide6.QtWebEngineWidgets',
        'PySide6.QtWebChannel',
        'PySide6.QtWebEngineCore',
        'qfluentwidgets',
        'qfluentwidgets.components',
        'openpyxl',
        'pptx',
        'docx',
        'reportlab',
        'SQLAlchemy',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'tkinter', 'PyQt5', 'PyQt6'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='电商经营驾驶舱Pro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # GUI 应用，不显示控制台
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # 可添加 icon='app.ico'
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='电商经营驾驶舱Pro',
)
