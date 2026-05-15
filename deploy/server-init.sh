#!/bin/bash
set -euo pipefail

echo "=== 1. 安装 Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker --now
  echo "Docker 安装完成"
else
  echo "Docker 已安装: $(docker --version)"
fi

echo ""
echo "=== 2. 安装 Docker Compose 插件 ==="
if ! docker compose version &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq docker-compose-plugin
  echo "Docker Compose 安装完成"
else
  echo "Docker Compose 已安装: $(docker compose version)"
fi

echo ""
echo "=== 3. 安装 Nginx ==="
if ! command -v nginx &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq nginx
  systemctl enable nginx --now
  echo "Nginx 安装完成"
else
  echo "Nginx 已安装: $(nginx -v 2>&1)"
fi

echo ""
echo "=== 4. 创建应用目录 ==="
mkdir -p /opt/steam-app
echo "目录 /opt/steam-app 已创建"

echo ""
echo "=== 5. 生成部署用 SSH 密钥 ==="
if [ ! -f ~/.ssh/deploy_key ]; then
  ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""
  cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  echo ""
  echo "=========================================="
  echo "请将以下私钥复制到 GitHub Secrets 的 SSH_PRIVATE_KEY:"
  echo "=========================================="
  cat ~/.ssh/deploy_key
  echo ""
  echo "=========================================="
else
  echo "部署密钥已存在: ~/.ssh/deploy_key"
fi

echo ""
echo "=== 初始化完成 ==="
echo ""
echo "接下来请手动完成:"
echo "1. 创建 /opt/steam-app/.env.production（填写 Supabase 公钥配置与 DASHSCOPE_API_KEY）"
echo "2. 复制 docker-compose.yml 到 /opt/steam-app/"
echo "3. 配置 Nginx 反向代理"
echo "4. 将 SSH 私钥添加到 GitHub Secrets"
