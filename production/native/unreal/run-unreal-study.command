#!/bin/zsh
set -eu
root="${0:A:h}"
project="$root/YunxiuNative/YunxiuNative.uproject"
engine="${YUNXIU_UNREAL_ENGINE_ROOT:-}"
if [[ -z "$engine" || ! -f "$engine/Engine/Build/Build.version" ]]; then
  print '未找到 UE5。请先完成官方安装，并用 YUNXIU_UNREAL_ENGINE_ROOT 指向 UE_5.8 安装目录。'
  exit 2
fi
if [[ -n "${YUNXIU_XCODE_APP:-}" ]]; then
  export DEVELOPER_DIR="$YUNXIU_XCODE_APP/Contents/Developer"
fi
if ! xcodebuild -version; then
  print '尚未配置完整 Xcode；Command Line Tools 不能替代完整开发环境。'
  exit 3
fi
if ! xcrun --find metal; then
  print '未找到 Metal 编译器。请在 Xcode 中安装匹配的 Metal Toolchain。'
  exit 4
fi
python3 - "$engine/Engine/Build/Build.version" <<'PY'
import json,sys
v=json.load(open(sys.argv[1]))
if (v['MajorVersion'],v['MinorVersion'])!=(5,8):
 raise SystemExit('当前工程暂按 UE5.8 准备；其他版本需先校对 API 与配置。')
PY
python3 "$root/stage_sources.py"
"$engine/Engine/Build/BatchFiles/Mac/Build.sh" YunxiuNativeEditor Mac Development "-Project=$project" -WaitMutex
"$engine/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor" "$project" "-ExecutePythonScript=$root/YunxiuNative/Content/Python/bootstrap_study.py" -log
