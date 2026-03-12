# ─── ECS Cluster ─────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "crm" {
  name = "${var.app_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_cluster_capacity_providers" "crm" {
  cluster_name       = aws_ecs_cluster.crm.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 70
    capacity_provider = "FARGATE"
  }

  default_capacity_provider_strategy {
    weight            = 30
    capacity_provider = "FARGATE_SPOT"
  }
}

# ─── Security Group ───────────────────────────────────────────────────────────
resource "aws_security_group" "ecs" {
  name   = "${var.app_name}-ecs-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# ─── Task Definition ──────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "crm" {
  family                   = "${var.app_name}-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "crm-backend"
    image = "${var.ecr_repository_url}:latest"
    portMappings = [{
      containerPort = 4000
      protocol      = "tcp"
    }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "4000" },
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.db_url.arn}" },
      { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.redis_url.arn}" },
      { name = "JWT_ACCESS_SECRET", valueFrom = "${aws_secretsmanager_secret.jwt_secrets.arn}:access::" },
      { name = "JWT_REFRESH_SECRET", valueFrom = "${aws_secretsmanager_secret.jwt_secrets.arn}:refresh::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.app_name}"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:4000/health || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = local.common_tags
}

# ─── ECS Service ──────────────────────────────────────────────────────────────
resource "aws_ecs_service" "crm" {
  name            = "${var.app_name}-${var.environment}"
  cluster         = aws_ecs_cluster.crm.id
  task_definition = aws_ecs_task_definition.crm.arn
  desired_count   = 2

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.crm.arn
    container_name   = "crm-backend"
    container_port   = 4000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  health_check_grace_period_seconds = 60

  tags = local.common_tags
}

# ─── Auto Scaling ─────────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "crm" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.crm.name}/${aws_ecs_service.crm.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.app_name}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.crm.resource_id
  scalable_dimension = aws_appautoscaling_target.crm.scalable_dimension
  service_namespace  = aws_appautoscaling_target.crm.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70
  }
}

# ─── KMS Key ─────────────────────────────────────────────────────────────────
resource "aws_kms_key" "crm" {
  description             = "CRM encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = local.common_tags
}

# ─── Secrets Manager ─────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "db_url" {
  name       = "${var.app_name}/${var.environment}/database-url"
  kms_key_id = aws_kms_key.crm.arn
  tags       = local.common_tags
}

resource "aws_secretsmanager_secret" "redis_url" {
  name       = "${var.app_name}/${var.environment}/redis-url"
  kms_key_id = aws_kms_key.crm.arn
  tags       = local.common_tags
}

resource "aws_secretsmanager_secret" "jwt_secrets" {
  name       = "${var.app_name}/${var.environment}/jwt-secrets"
  kms_key_id = aws_kms_key.crm.arn
  tags       = local.common_tags
}

# ─── CloudWatch Log Group ─────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "crm" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 30
  tags              = local.common_tags
}

# ─── ALB ─────────────────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name   = "${var.app_name}-alb-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_lb" "crm" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = true
  drop_invalid_header_fields = true

  tags = local.common_tags
}

resource "aws_lb_target_group" "crm" {
  name        = "${var.app_name}-tg"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = local.common_tags
}

variable "ecr_repository_url" {}
