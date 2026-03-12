# ─── RDS Parameter Group ──────────────────────────────────────────────────────
resource "aws_db_parameter_group" "crm" {
  name   = "${var.app_name}-pg16"
  family = "postgres16"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log queries > 1s
  }

  tags = local.common_tags
}

# ─── RDS Subnet Group ─────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "crm" {
  name       = "${var.app_name}-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = local.common_tags
}

# ─── Security Group ───────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name   = "${var.app_name}-rds-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = local.common_tags
}

# ─── RDS Instance (Multi-AZ for HA) ──────────────────────────────────────────
resource "aws_db_instance" "crm" {
  identifier = "${var.app_name}-${var.environment}"

  engine         = "postgres"
  engine_version = "16.3"
  instance_class = "db.t3.medium"

  db_name  = "crm_db"
  username = "crm_admin"
  password = var.db_password

  # Storage
  allocated_storage     = 20
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.crm.arn

  # High Availability
  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.crm.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.crm.name

  # Backup
  backup_retention_period   = 7
  backup_window             = "03:00-04:00"
  maintenance_window        = "sun:04:00-sun:05:00"
  delete_automated_backups  = false
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.app_name}-final-snapshot"

  # Monitoring
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true

  tags = local.common_tags
}

# ─── RDS Read Replica ─────────────────────────────────────────────────────────
resource "aws_db_instance" "crm_replica" {
  identifier          = "${var.app_name}-${var.environment}-replica"
  replicate_source_db = aws_db_instance.crm.identifier
  instance_class      = "db.t3.medium"

  # Read replicas don't need multi-az themselves
  multi_az               = false
  vpc_security_group_ids = [aws_security_group.rds.id]

  storage_encrypted            = true
  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn

  tags = merge(local.common_tags, { Role = "replica" })
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.app_name}-rds-monitoring"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

output "rds_endpoint" { value = aws_db_instance.crm.endpoint }
output "rds_replica_endpoint" { value = aws_db_instance.crm_replica.endpoint }
