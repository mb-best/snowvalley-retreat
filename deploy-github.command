#!/bin/zsh
set -eu
cd -- "${0:A:h}"
print '雪隐山居 GitHub 迁移：完整文件和版本历史将上传到 mb-best/snowvalley-retreat。'
print '1：公开仓库，使用免费 GitHub Pages；源码、资源和历史公开可见。'
print '2：私有仓库；GitHub Pages 需 GitHub Pro 等支持私有 Pages 的套餐。'
read 'choice?请选择 1 或 2（其他输入取消）：'
case "$choice" in
  1) audience=public;;
  2) audience=private;;
  *) print '已取消，未上传。';exit 0;;
esac
if (( ! $+commands[gh] )); then
 print '需要 GitHub 官方命令行 gh。可运行 brew install gh 后重新打开本文件。'
 read 'ignored?按回车结束。'
 exit 1
fi
python3 scripts/migration/deploy-github.py --visibility "$audience"
read 'ignored?按回车结束。'
