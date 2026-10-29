#!/bin/zsh
set -eu
script_dir="${0:A:h}"
project_dir="${script_dir:h:h}"
portable_bin="${project_dir:h}/production-tools/blender-4.5.15/Blender/Blender.app/Contents/MacOS/Blender"
blender_bin="${YUNXIU_BLENDER:-$portable_bin}"
if [[ ! -x "$blender_bin" && -x /Applications/Blender.app/Contents/MacOS/Blender ]]; then
  blender_bin=/Applications/Blender.app/Contents/MacOS/Blender
fi
if [[ ! -x "$blender_bin" ]]; then
  print '未找到 Blender。安装官方 Apple Silicon 版本后再运行，或用 YUNXIU_BLENDER 指定可执行文件。'
  exit 1
fi
function finish {
  result=$?
  if (( result != 0 )); then
    print '\n本机制作未完成，已有模型保留。请把最后几行错误发回对话。'
  fi
  read 'ignored?按回车关闭窗口。' || true
}
trap finish EXIT
cd -- "$project_dir"
export BLENDER_USER_RESOURCES="$project_dir/production/native/generated/blender-profile"
mkdir -p "$BLENDER_USER_RESOURCES"
print '雪隐山居 · 本机 Blender 地形与岩石样品'
print '这一步创建独立的可编辑样品，不发布或替换在线游戏。'
node scripts/export-native-terrain.mjs
node scripts/check-native-terrain.mjs
node scripts/export-native-study-glb.mjs
run_dir="$project_dir/production/native/generated/local-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run_dir"
"$blender_bin" --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python production/native/blender/import_geography.py -- \
  --bundle production/native/generated/revision-1597 --output "$run_dir/yunxiu-geography.blend"
model="$project_dir/production/native/generated/material-study-v02/yunxiu-rock-moss-v02.glb"
if [[ -s "$model" ]]; then
  "$blender_bin" --background --factory-startup --disable-autoexec --python-exit-code 1 \
    --python production/native/blender/build_rock_asset.py -- \
    --model "$model" --output "$run_dir/rock-study" --render
fi
print "\n本机制作完成：$run_dir"
