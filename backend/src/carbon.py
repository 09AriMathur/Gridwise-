"""Turning carbon intensity into numbers a person can read.

Intensity comes back as gCO2eq/kWh. Multiply by the energy a task uses to get
grams of CO2, then compare against running it right now to get the savings.
"""


def emissions_grams(intensity_gco2_per_kwh: float, energy_kwh: float) -> float:
    """Grams of CO2 for running something that uses `energy_kwh`."""
    raise NotImplementedError


def savings_vs_now(best_intensity: float, now_intensity: float, energy_kwh: float) -> dict:
    """How much CO2 waiting for the best window saves."""
    raise NotImplementedError
