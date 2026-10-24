"""Turning carbon intensity into numbers a person can read.

Intensity comes back as gCO2eq/kWh. Multiply by the energy a task uses to get
grams of CO2, then compare against running it now to get the savings.
"""


def emissions_grams(intensity_gco2_per_kwh: float, energy_kwh: float) -> float:
    """Grams of CO2 for running something that uses `energy_kwh`."""
    if energy_kwh < 0:
        raise ValueError("energy_kwh cannot be negative")
    return round(intensity_gco2_per_kwh * energy_kwh, 1)


def savings_vs_now(best_intensity: float, now_intensity: float, energy_kwh: float) -> dict:
    """How much CO2 waiting for the best window saves."""
    grams_best = emissions_grams(best_intensity, energy_kwh)
    grams_now = emissions_grams(now_intensity, energy_kwh)
    saved = round(grams_now - grams_best, 1)

    # A flat forecast means nothing to save, and dividing by it would blow up.
    percent = round(saved / grams_now * 100, 1) if grams_now else 0.0

    return {
        "grams_in_window": grams_best,
        "grams_if_now": grams_now,
        "grams_saved": saved,
        "percent_saved": percent,
    }
