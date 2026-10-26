<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a refresh-token rotation is attempted against a session that no
 * longer exists or has been revoked (logout, password change/reset, admin kill).
 *
 * The controller turns this into a 401 so a revoked/stolen refresh token can
 * never silently resurrect a new session.
 */
class SessionRevokedException extends RuntimeException {}
