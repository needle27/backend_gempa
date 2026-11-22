class ServiceError(Exception):
    """Base exception for expected business/service failures."""


class ValidationError(ServiceError):
    """Input or dataset validation failed."""


class NotFoundError(ServiceError):
    """Requested database entity does not exist."""


class ConflictError(ServiceError):
    """Requested operation conflicts with existing state."""


class ProcessingError(ServiceError):
    """A scientific processing operation failed."""


class JobPaused(Exception):
    """Internal signal: task reached a durable pause checkpoint."""


class JobCancelled(Exception):
    """Internal signal: task reached a durable stop checkpoint."""
