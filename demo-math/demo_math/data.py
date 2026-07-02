"""Demo data loaders for Mentor plugin system."""

import numpy as np


def generate_sample(n: int = 100, mean: float = 0.0, std: float = 1.0) -> np.ndarray:
    """Generate synthetic measurement data from a normal distribution."""
    rng = np.random.default_rng()
    return rng.normal(loc=mean, scale=std, size=n)


def load_csv(filepath: str) -> np.ndarray:
    """Load data from a CSV file using numpy."""
    return np.genfromtxt(filepath, delimiter=",", skip_header=0)
