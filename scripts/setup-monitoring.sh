#!/bin/bash

# Atlas2 Monitoring Setup Script
# This script sets up the complete monitoring stack for Atlas2

set -e

echo "🚀 Setting up Atlas2 monitoring stack..."

# Create necessary directories
echo "📁 Creating log directories..."
mkdir -p logs/api
mkdir -p logs/worker
mkdir -p logs/nginx
mkdir -p monitoring/prometheus/rules
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/loki
mkdir -p monitoring/promtail

# Set proper permissions
echo "🔐 Setting permissions..."
chmod 755 logs/
chmod 755 logs/api
chmod 755 logs/worker
chmod 755 logs/nginx

# Create log rotation configuration
echo "📋 Setting up log rotation..."
cat > /etc/logrotate.d/atlas2 << 'EOF'
/var/log/atlas2/api/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker kill -s USR1 atlas2-api 2>/dev/null || true
    endscript
}

/var/log/atlas2/worker/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker kill -s USR1 atlas2-worker 2>/dev/null || true
    endscript
}
EOF

# Create monitoring environment file
echo "🔧 Creating monitoring environment..."
cat > .monitoring.env << 'EOF'
# Prometheus Configuration
PROMETHEUS_RETENTION=200h
PROMETHEUS_STORAGE_SIZE=10GB

# Grafana Configuration
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin123
GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource

# Loki Configuration
LOKI_RETENTION=168h

# Alert Manager
ALERT_MANAGER_TIMEOUT=10s
EOF

# Create startup script for monitoring
echo "🎬 Creating monitoring startup script..."
cat > scripts/start-monitoring.sh << 'EOF'
#!/bin/bash

# Start monitoring stack
echo "🚀 Starting Atlas2 monitoring stack..."

# Start core monitoring services
docker-compose -f docker-compose.dev.yml up -d prometheus grafana loki promtail node-exporter

echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Check Prometheus
if curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
    echo "✅ Prometheus is healthy"
else
    echo "❌ Prometheus is not healthy"
fi

# Check Grafana
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "✅ Grafana is healthy"
else
    echo "❌ Grafana is not healthy"
fi

# Check Loki
if curl -f http://localhost:3100/ready > /dev/null 2>&1; then
    echo "✅ Loki is healthy"
else
    echo "❌ Loki is not healthy"
fi

echo ""
echo "🎯 Monitoring URLs:"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana: http://localhost:3002 (admin/admin123)"
echo "  Loki: http://localhost:3100"
echo ""
echo "📊 Grafana Dashboards:"
echo "  Atlas2 Overview: http://localhost:3002/d/atlas2-overview/atlas2-overview"
EOF

chmod +x scripts/start-monitoring.sh

# Create monitoring health check script
echo "🏥 Creating health check script..."
cat > scripts/monitoring-health.sh << 'EOF'
#!/bin/bash

# Check health of all monitoring services
echo "🏥 Atlas2 Monitoring Health Check"
echo "================================="

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name... "
    
    if curl -f -s -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        echo "✅ Healthy"
        return 0
    else
        echo "❌ Unhealthy"
        return 1
    fi
}

# Check services
check_service "Prometheus" "http://localhost:9090/-/healthy"
check_service "Grafana" "http://localhost:3002/api/health"
check_service "Loki" "http://localhost:3100/ready"

# Check Prometheus targets
echo ""
echo "📊 Prometheus Targets:"
curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job): \(.health)"'

# Check Grafana datasources
echo ""
echo "📈 Grafana Datasources:"
curl -s -u admin:admin123 http://localhost:3002/api/datasources | jq -r '.[] | "\(.name): \(.type)"'

echo ""
echo "🎯 Quick Links:"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana: http://localhost:3002"
echo "  Loki: http://localhost:3100"
EOF

chmod +x scripts/monitoring-health.sh

# Create monitoring cleanup script
echo "🧹 Creating cleanup script..."
cat > scripts/cleanup-monitoring.sh << 'EOF'
#!/bin/bash

# Cleanup monitoring stack
echo "🧹 Cleaning up Atlas2 monitoring stack..."

# Stop and remove monitoring containers
docker-compose -f docker-compose.dev.yml down prometheus grafana loki promtail node-exporter

# Remove monitoring volumes (optional)
read -p "Remove monitoring data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker volume rm atlas2_prometheus_data atlas2_grafana_data atlas2_loki_data
    echo "🗑️  Monitoring volumes removed"
fi

echo "✅ Monitoring stack cleaned up"
EOF

chmod +x scripts/cleanup-monitoring.sh

echo ""
echo "✅ Monitoring setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Start monitoring: ./scripts/start-monitoring.sh"
echo "  2. Check health: ./scripts/monitoring-health.sh"
echo "  3. Access Grafana: http://localhost:3002 (admin/admin123)"
echo "  4. Access Prometheus: http://localhost:9090"
echo ""
echo "📚 Documentation:"
echo "  - Monitoring guide: docs/monitoring.md"
echo "  - Alert rules: monitoring/alert_rules.yml"
echo "  - Dashboards: monitoring/grafana/dashboards/"