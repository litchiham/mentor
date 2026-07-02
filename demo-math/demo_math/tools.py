"""Demo math tools for Mentor plugin system."""

import math


def quadratic_solver(a: float, b: float, c: float) -> list[float]:
    """Solve ax^2 + bx + c = 0. Returns sorted list of real roots."""
    if a == 0:
        raise ValueError("Coefficient 'a' must not be zero")
    discriminant = b * b - 4 * a * c
    if discriminant < 0:
        return []
    sqrt_d = math.sqrt(discriminant)
    roots = [(-b - sqrt_d) / (2 * a), (-b + sqrt_d) / (2 * a)]
    roots.sort()
    return [roots[0]] if discriminant == 0 else roots


def statistics(data: list[float]) -> dict:
    """Compute basic descriptive statistics."""
    import numpy as np
    arr = np.array(data, dtype=float)
    return {
        "count": int(len(arr)),
        "mean": float(np.mean(arr)),
        "std": float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0,
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "median": float(np.median(arr)),
    }
