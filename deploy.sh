#!/bin/bash
# Deploy: git pull auf dem Server ausführen
ssh root@202.61.194.129 "cd /var/www/blogwerk && git pull origin main && echo 'Deploy OK'"
