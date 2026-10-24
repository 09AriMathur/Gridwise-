"""What the grid is made of, as shares a person can read.

Rows come from grid_api: {"datetime", "sources": {name: MW}, "imports", "exports"}.
Shares are of total supply (local generation plus imports), so they add up
to 100. Pure functions: no network, no file I/O, no env vars.
"""

from datetime import datetime, timedelta

LOW_CARBON = {"nuclear", "wind", "solar", "hydro", "geothermal", "biomass", "storage"}
FOSSIL = {"gas", "coal", "oil"}

LABELS = {
    "nuclear": "Nuclear", "wind": "Wind", "solar": "Solar", "hydro": "Hydro",
    "geothermal": "Geothermal", "biomass": "Biomass", "storage": "Storage",
    "gas": "Gas", "coal": "Coal", "oil": "Oil", "unknown": "Unknown", "imports": "Imports",
}

HOUR = timedelta(hours=1)


def _parse(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def shares(row: dict) -> dict:
    """Turn one mix row into sorted shares plus low-carbon / fossil / import totals."""
    supply = {name: mw for name, mw in row.get("sources", {}).items() if mw > 0}
    if row.get("imports", 0) > 0:
        supply["imports"] = row["imports"]
    total = sum(supply.values())
    if total <= 0:
        return {"datetime": row.get("datetime"), "total_mw": 0.0, "sources": [],
                "low_carbon_pct": 0.0, "fossil_pct": 0.0, "imports_pct": 0.0}

    items = sorted(supply.items(), key=lambda item: item[1], reverse=True)
    sources = [
        {
            "key": name,
            "label": LABELS.get(name, name.title()),
            "mw": round(mw, 1),
            "percent": round(mw / total * 100, 1),
            "low_carbon": name in LOW_CARBON,
        }
        for name, mw in items
    ]

    def pct(names: set[str]) -> float:
        return round(sum(mw for name, mw in supply.items() if name in names) / total * 100, 1)

    return {
        "datetime": row.get("datetime"),
        "total_mw": round(total, 1),
        "sources": sources,
        "low_carbon_pct": pct(LOW_CARBON),
        "fossil_pct": pct(FOSSIL),
        "imports_pct": pct({"imports"}),
    }


def window_mix(rows: list[dict], start: datetime, end: datetime) -> dict | None:
    """Average the hourly rows that overlap [start, end), weighted by overlap, then share them out."""
    totals: dict[str, float] = {}
    imports = 0.0
    weight = 0.0
    for row in rows:
        row_start = _parse(row["datetime"])
        overlap = (min(end, row_start + HOUR) - max(start, row_start)).total_seconds()
        if overlap <= 0:
            continue
        weight += overlap
        imports += row.get("imports", 0.0) * overlap
        for name, mw in row.get("sources", {}).items():
            totals[name] = totals.get(name, 0.0) + mw * overlap
    if weight <= 0:
        return None
    averaged = {"sources": {name: mw / weight for name, mw in totals.items()}, "imports": imports / weight}
    result = shares(averaged)
    result["datetime"] = None
    return result


def summary(row: dict) -> dict:
    """The few numbers a forecast chart needs for one hour."""
    s = shares(row)
    top = s["sources"][0] if s["sources"] else None
    return {
        "datetime": row.get("datetime"),
        "low_carbon_pct": s["low_carbon_pct"],
        "fossil_pct": s["fossil_pct"],
        "top": {"key": top["key"], "label": top["label"], "percent": top["percent"]} if top else None,
    }
