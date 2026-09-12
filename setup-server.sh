#!/bin/bash
set -euo pipefail
cat > /etc/systemd/system/velmor-web.service <<'EOF'
[Unit]
Description=Velmor public website
After=network.target
[Service]
User=badeea
Group=badeea
WorkingDirectory=/opt/velmor-store/bot
ExecStart=/opt/velmor-store/bot/.venv/bin/python -m app.services.web_attribution
Restart=on-failure
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/velmor-store
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/nginx/sites-available/velmorstore <<'EOF'
limit_req_zone $binary_remote_addr zone=velmor:10m rate=5r/s;
server {
 listen 80;
 server_name velmorstore.online www.velmorstore.online;
 client_max_body_size 5m;
 add_header X-Content-Type-Options nosniff always;
 add_header Referrer-Policy strict-origin-when-cross-origin always;
 location / {
  limit_req zone=velmor burst=10 nodelay;
  proxy_pass http://127.0.0.1:8091;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Real-IP $remote_addr;
 }
}
EOF
ln -sf /etc/nginx/sites-available/velmorstore /etc/nginx/sites-enabled/velmorstore
systemctl daemon-reload
systemctl enable --now velmor-web
nginx -t
ufw allow 'Nginx Full'
systemctl reload nginx
certbot --nginx -d velmorstore.online -d www.velmorstore.online --non-interactive --agree-tos --register-unsafely-without-email --redirect
systemctl is-active velmor-web nginx velmor-store
