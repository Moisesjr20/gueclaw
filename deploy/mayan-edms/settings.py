"""
Mayan EDMS Custom Settings
Document Governance System - GueClaw Agent
"""

# ============================================
# SECURITY SETTINGS
# ============================================

# Allow CORS for API access from GueClaw Agent
CORS_ORIGIN_ALLOW_ALL = True
CORS_ALLOW_CREDENTIALS = True

# API settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
}

# ============================================
# DOCUMENT SETTINGS
# ============================================

# Enable OCR for all uploaded documents
OCR_ALWAYS_GENERATE_PDF = True
OCR_LANGUAGE = 'por+eng'

# Document versioning
DOCUMENT_VERSIONS_KEEP_COUNT = 10

# ============================================
# CELERY SETTINGS
# ============================================

CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000

# ============================================
# LOGGING
# ============================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/log/mayan/mayan.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'mayan': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

# ============================================
# STORAGE
# ============================================

# Use filesystem storage (can be changed to S3 later)
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# ============================================
# PERFORMANCE
# ============================================

# Database optimizations
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'mayan',
        'USER': 'mayan',
        'PASSWORD': 'mayan_secure_password_2026',
        'HOST': 'postgres',
        'PORT': '5432',
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}

# Cache with Redis
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://redis:6379/0',
    }
}

# ============================================
# FILE UPLOAD
# ============================================

FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB

# ============================================
# CUSTOM TAGS FOR GOVERNANCE
# ============================================

# Tags automáticos para classificação de segurança
GOVERNANCE_TAGS = [
    'public',
    'internal',
    'confidential',
    'secret',
    'pii-detected',
    'financial',
    'legal',
    'medical',
    'hr',
    'contract',
    'invoice',
    'report',
]
