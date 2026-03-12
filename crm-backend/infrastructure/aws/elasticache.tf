# ─── ElastiCache Subnet Group ─────────────────────────────────────────────────
resource "aws_elasticache_subnet_group" "crm" {
  name       = "${var.app_name}-redis-subnet"
  subnet_ids = var.private_subnet_ids
  tags       = local.common_tags
}

# ─── Security Group ───────────────────────────────────────────────────────────
resource "aws_security_group" "redis" {
  name   = "${var.app_name}-redis-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = local.common_tags
}

# ─── ElastiCache Replication Group (Redis cluster with HA) ────────────────────
resource "aws_elasticache_replication_group" "crm" {
  replication_group_id = "${var.app_name}-redis"
  description          = "CRM Redis cluster for sessions and token cache"

  node_type            = "cache.t3.medium"
  num_cache_clusters   = 2 # primary + 1 replica
  port                 = 6379

  subnet_group_name          = aws_elasticache_subnet_group.crm.name
  security_group_ids         = [aws_security_group.redis.id]
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Encryption
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  kms_key_id                  = aws_kms_key.crm.arn

  # Maintenance
  maintenance_window      = "sun:05:00-sun:06:00"
  snapshot_retention_limit = 3
  snapshot_window         = "04:00-05:00"

  # Redis version
  engine_version = "7.1"

  apply_immediately = false

  tags = local.common_tags
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.crm.primary_endpoint_address
}
output "redis_reader_endpoint" {
  value = aws_elasticache_replication_group.crm.reader_endpoint_address
}
