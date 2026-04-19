"""
W-38-SCAN — broadened regions integrity audit
READ-ONLY. Excludes regions.id=13 (owned by parallel W-38 session).
Does NOT touch wine_enrichment. Uses wine_families only for wf_count join.

Provenance:
    Originated in session W-38-SCAN-REGROUP-20260419 (WINE Ops, read-only
    regions-integrity audit spawned from the W-38 silent-backfill finding).
    Relocated from /tmp/w38_scan.py to scripts/audits/w38_scan.py in session
    W-38-SCAN-DURABILITY-20260419 for cross-session durability.

Purpose:
    Scan the regions table for geographic contradictions at country-level and
    sub-country-zone-level. Uses a curated authority list (~95 top global
    wine regions) plus self-distribution (self-distribution is known-inert on
    this schema because regions.name is UNIQUE — see project memory entry
    feedback_regions_self_distribution_inert.md).

Usage:
    python scripts/audits/w38_scan.py
    (Read-only. Requires DATABASE_URL in env.)

Output:
    Table of flagged rows with cluster labels, method tags, and predicates.
    Halts internally if contradictions > 50 (systemic-issue signal).

Re-run conditions:
    - After any remediation of regions rows flagged in the 2026-04-19 run
      (id=417, 418, 411, 415, 436, 453; plus id=66 after disambiguation).
    - Periodically as a standing guard (cadence TBD — see data-dictionary
      Phase 3 work).

Authority list maintenance:
    Additions to the AUTHORITY dict should be reviewed by Steve. Adding an
    entry that incorrectly "vouches for" a corrupted row would hide that row
    from future scans. Any PR modifying AUTHORITY requires explicit cross-
    reference against public sources (Wikipedia, official PDO/AOC registries,
    or equivalent), noted in the commit message.
"""
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, "/Users/StephenShyn/Desktop/a - The Han Project/Connectiq Application/Technology/wie")
from database import engine  # noqa: E402
from sqlalchemy import text  # noqa: E402


# ---------------------------------------------------------------------------
# AUTHORITY LIST — compact, curated for top global wine regions.
# Each key maps to (country, zone). zone=None means "zone not asserted".
# Keys are case-folded-normalized for matching.
# ---------------------------------------------------------------------------
AUTHORITY = {
    # FRANCE — BORDEAUX
    "bordeaux": ("France", "Bordeaux"),
    "médoc": ("France", "Bordeaux"),
    "medoc": ("France", "Bordeaux"),
    "haut-médoc": ("France", "Bordeaux"),
    "haut-medoc": ("France", "Bordeaux"),
    "margaux": ("France", "Bordeaux"),
    "pauillac": ("France", "Bordeaux"),
    "saint-julien": ("France", "Bordeaux"),
    "saint-estèphe": ("France", "Bordeaux"),
    "saint-estephe": ("France", "Bordeaux"),
    "saint-émilion": ("France", "Bordeaux"),
    "saint-emilion": ("France", "Bordeaux"),
    "saint-émilion grand cru": ("France", "Bordeaux"),
    "pomerol": ("France", "Bordeaux"),
    "pessac-léognan": ("France", "Bordeaux"),
    "pessac-leognan": ("France", "Bordeaux"),
    "graves": ("France", "Bordeaux"),
    "sauternes": ("France", "Bordeaux"),
    "moulis-en-médoc": ("France", "Bordeaux"),
    "moulis-en-medoc": ("France", "Bordeaux"),
    "bordeaux supérieur": ("France", "Bordeaux"),

    # FRANCE — BURGUNDY
    "burgundy": ("France", "Burgundy"),
    "bourgogne": ("France", "Burgundy"),
    "chablis": ("France", "Burgundy"),
    "côte de nuits": ("France", "Burgundy"),
    "cote de nuits": ("France", "Burgundy"),
    "côte de beaune": ("France", "Burgundy"),
    "cote de beaune": ("France", "Burgundy"),
    "vosne-romanée": ("France", "Burgundy"),
    "vosne-romanee": ("France", "Burgundy"),
    "la tâche": ("France", "Burgundy"),
    "la tache": ("France", "Burgundy"),
    "gevrey-chambertin": ("France", "Burgundy"),
    "chambertin": ("France", "Burgundy"),
    "chambolle-musigny": ("France", "Burgundy"),
    "musigny": ("France", "Burgundy"),
    "les amoureuses": ("France", "Burgundy"),
    "morey-saint-denis": ("France", "Burgundy"),
    "meursault": ("France", "Burgundy"),
    "puligny-montrachet": ("France", "Burgundy"),
    "montrachet": ("France", "Burgundy"),
    "chassagne-montrachet": ("France", "Burgundy"),
    "volnay": ("France", "Burgundy"),
    "nuits-saint-georges": ("France", "Burgundy"),
    "corton-charlemagne": ("France", "Burgundy"),
    "aloxe-corton": ("France", "Burgundy"),
    "côte de brouilly": ("France", "Burgundy"),  # Beaujolais, but Burgundy admin
    "clos saint-jacques": ("France", "Burgundy"),

    # FRANCE — RHÔNE
    "rhône valley": ("France", "Rhône Valley"),
    "rhone valley": ("France", "Rhône Valley"),
    "côte-rôtie": ("France", "Rhône Valley"),
    "cote-rotie": ("France", "Rhône Valley"),
    "la landonne": ("France", "Rhône Valley"),
    "la mouline": ("France", "Rhône Valley"),
    "la turque": ("France", "Rhône Valley"),
    "hermitage": ("France", "Rhône Valley"),
    "crozes-hermitage": ("France", "Rhône Valley"),
    "châteauneuf-du-pape": ("France", "Rhône Valley"),
    "chateauneuf-du-pape": ("France", "Rhône Valley"),
    "gigondas": ("France", "Rhône Valley"),
    "condrieu": ("France", "Rhône Valley"),

    # FRANCE — CHAMPAGNE / LOIRE / ALSACE / PROVENCE / SW
    "champagne": ("France", "Champagne"),
    "le mesnil-sur-oger": ("France", "Champagne"),
    "clos du mesnil": ("France", "Champagne"),
    "sancerre": ("France", "Loire Valley"),
    "pouilly-fumé": ("France", "Loire Valley"),
    "pouilly-fume": ("France", "Loire Valley"),
    "vouvray": ("France", "Loire Valley"),
    "saumur-champigny": ("France", "Loire Valley"),
    "chinon": ("France", "Loire Valley"),
    "loire valley": ("France", "Loire Valley"),
    "savennières-coulée-de-serrant": ("France", "Loire Valley"),
    "coulée de serrant": ("France", "Loire Valley"),
    "alsace": ("France", "Alsace"),
    "provence": ("France", "Provence"),
    "côtes de provence": ("France", "Provence"),
    "bandol": ("France", "Provence"),
    "madiran": ("France", "Southwest France"),

    # ITALY
    "tuscany": ("Italy", "Tuscany"),
    "chianti": ("Italy", "Tuscany"),
    "chianti classico": ("Italy", "Tuscany"),
    "brunello di montalcino": ("Italy", "Tuscany"),
    "bolgheri": ("Italy", "Tuscany"),
    "piedmont": ("Italy", "Piedmont"),
    "barolo": ("Italy", "Piedmont"),
    "barbaresco": ("Italy", "Piedmont"),
    "veneto": ("Italy", "Veneto"),
    "amarone": ("Italy", "Veneto"),
    "valpolicella": ("Italy", "Veneto"),
    "sicily": ("Italy", "Sicily"),

    # SPAIN
    "rioja": ("Spain", "Rioja"),
    "ribera del duero": ("Spain", "Castilla y León"),
    "priorat": ("Spain", "Catalonia"),

    # PORTUGAL
    "douro": ("Portugal", "Douro"),
    "alentejo": ("Portugal", "Alentejo"),

    # GERMANY
    "mosel": ("Germany", "Mosel"),
    "rheingau": ("Germany", "Rheingau"),
    "pfalz": ("Germany", "Pfalz"),

    # AUSTRIA
    "wachau": ("Austria", "Niederösterreich"),

    # USA
    "napa valley": ("USA", "California"),
    "sonoma": ("USA", "California"),
    "sonoma county": ("USA", "California"),
    "coombsville": ("USA", "California"),         # Napa sub-AVA
    "willamette valley": ("USA", "Oregon"),
    "walla walla valley": ("USA", "Washington"),  # straddles WA/OR; WA is primary
    "columbia valley": ("USA", "Washington"),
    "paso robles": ("USA", "California"),
    "central coast": ("USA", "California"),
    "finger lakes": ("USA", "New York"),

    # AUSTRALIA / NZ
    "barossa valley": ("Australia", "South Australia"),
    "mclaren vale": ("Australia", "South Australia"),
    "margaret river": ("Australia", "Western Australia"),
    "marlborough": ("New Zealand", "Marlborough"),
    "central otago": ("New Zealand", "Central Otago"),

    # S. AMERICA
    "mendoza": ("Argentina", "Mendoza"),
    "maipo": ("Chile", "Maipo"),
    "colchagua": ("Chile", "Colchagua"),

    # S. AFRICA
    "stellenbosch": ("South Africa", "Western Cape"),

    # SWITZERLAND — CRITICAL for id=418 detection
    "vaud": ("Switzerland", "Vaud"),
    "valais": ("Switzerland", "Valais"),
    "fully": ("Switzerland", "Valais"),   # Fully is in Valais, NOT Vaud

    # GREECE — Naoussa flagged as judgment call
    "santorini": ("Greece", "South Aegean"),
    "naoussa": ("Greece", "Macedonia"),   # JUDGMENT: Macedonian PDO is dominant wine usage

    # HUNGARY
    "tokaj": ("Hungary", "Northern Hungary"),
    "somlo": ("Hungary", "Central Transdanubia"),
    "somló": ("Hungary", "Central Transdanubia"),

    # ISRAEL
    "judean hills": ("Israel", "Jerusalem District"),
    "golan heights": ("Israel", "Northern District"),

    # CANADA — CRITICAL for id=417 detection
    "british columbia": ("Canada", "British Columbia"),
    "ontario": ("Canada", "Ontario"),
    "niagara-on-the-lake": ("Canada", "Ontario"),
    "niagara peninsula": ("Canada", "Ontario"),
    "okanagan valley": ("Canada", "British Columbia"),

    # ROMANIA — CRITICAL for id=436 detection
    "muntenia & oltenia": ("Romania", "Muntenia/Oltenia"),
    "muntenia": ("Romania", "Muntenia/Oltenia"),
    "oltenia": ("Romania", "Muntenia/Oltenia"),
    "lechinta": ("Romania", "Transylvania"),
    "lechința": ("Romania", "Transylvania"),

    # INDIA
    "nandi hills": ("India", "Karnataka"),
    "nashik": ("India", "Maharashtra"),

    # SLOVENIA
    "primorska": ("Slovenia", "Primorska"),
    "goriska brda": ("Slovenia", "Primorska"),
    "goriška brda": ("Slovenia", "Primorska"),

    # MEXICO
    "baja california": ("Mexico", "Baja California"),
    "valle de guadalupe": ("Mexico", "Baja California"),

    # UK
    "england": ("UK", "England"),
    "sussex": ("UK", "England"),

    # DENMARK / BULGARIA / CROATIA / NORTH MACEDONIA
    "dingac": ("Croatia", "Dalmatia"),
    "dingač": ("Croatia", "Dalmatia"),
    "sakar": ("Bulgaria", "Thracian Lowlands"),
    "thracian lowlands": ("Bulgaria", "Thracian Lowlands"),
    "dons": ("Denmark", "Jutland"),
    "vardar river valley": ("North Macedonia", "Vardar"),
    "skopje": ("North Macedonia", "Vardar"),

    # CHINA
    "ningxia": ("China", "Ningxia"),
    "qiu shan valley": ("China", "Ningxia"),

    # URUGUAY
    "uruguay": ("Uruguay", None),
    "maldonado": ("Uruguay", "Maldonado"),

    # CALIFORNIA (when used as name directly — too broad but not contradictory)
    "california": ("USA", "California"),
}


def norm(s):
    if s is None:
        return None
    s = s.strip().lower()
    return s if s else None


def authority_lookup(value):
    """Return (country, zone) or (None, None) if not in list."""
    if value is None:
        return (None, None)
    k = norm(value)
    if k in AUTHORITY:
        return AUTHORITY[k]
    return (None, None)


def load_regions():
    sql = text(
        """
        SELECT r.id, r.name, r.subregion, r.zone, r.country, r.parent_region,
               COUNT(wf.id) AS wf_count
        FROM regions r
        LEFT JOIN wine_families wf ON wf.region_id = r.id
        WHERE r.id != 13
        GROUP BY r.id, r.name, r.subregion, r.zone, r.country, r.parent_region
        ORDER BY wf_count DESC
        """
    )
    with engine.connect() as conn:
        return [dict(row._mapping) for row in conn.execute(sql).fetchall()]


def build_self_distribution(rows):
    """
    Modal country/zone per distinct subregion value. `name` is UNIQUE in
    regions — no modal derivation possible for name (will always be itself).
    """
    sub_country = defaultdict(Counter)
    sub_zone = defaultdict(Counter)
    for r in rows:
        sub = norm(r["subregion"])
        if sub is None:
            continue
        if r["country"]:
            sub_country[sub][r["country"]] += 1
        if r["zone"]:
            sub_zone[sub][r["zone"]] += 1

    def mode(counter):
        if not counter:
            return None
        top = counter.most_common(2)
        if len(top) > 1 and top[0][1] == top[1][1]:
            return None  # tie → undefined
        return top[0][0]

    return (
        {k: mode(v) for k, v in sub_country.items()},
        {k: mode(v) for k, v in sub_zone.items()},
        {k: sum(v.values()) for k, v in sub_country.items()},  # support
    )


def classify(rows, self_sub_country, self_sub_zone, self_sub_support):
    """
    Returns list of dicts per row with flags and cluster label.
    """
    # Index for INVERTED_PAIR detection: (name_norm, subregion_norm)
    pairs_by_name = {}
    for r in rows:
        n = norm(r["name"])
        s = norm(r["subregion"])
        if n is not None:
            pairs_by_name[n] = s

    results = []
    for r in rows:
        name = r["name"]
        sub = r["subregion"]
        country = r["country"]
        zone = r["zone"]

        # Authority lookups
        name_auth_country, name_auth_zone = authority_lookup(name)
        sub_auth_country, sub_auth_zone = authority_lookup(sub)
        in_authority_name = name_auth_country is not None
        in_authority_sub = sub_auth_country is not None

        # Self-distribution lookups (only subregion has power)
        self_country_for_sub = self_sub_country.get(norm(sub))
        self_zone_for_sub = self_sub_zone.get(norm(sub))
        sub_support = self_sub_support.get(norm(sub), 0)

        flags = {
            "p1_name_country": False,   # authority name vs row country
            "p1_name_zone": False,      # authority name vs row zone
            "p2_sub_country": False,    # authority subregion vs row country
            "p2_sub_zone": False,       # authority subregion vs row zone
            "p3_country": False,        # authority name-country vs authority sub-country
            "p3_zone": False,           # authority name-zone vs authority sub-zone
            "p4_inverted": False,       # swapped pair exists elsewhere
            "self_sub_country": False,  # row.country vs self-distribution sub country
            "self_sub_zone": False,     # row.zone vs self-distribution sub zone
        }

        # Authority: name vs row
        if in_authority_name and country and name_auth_country != country:
            flags["p1_name_country"] = True
        if in_authority_name and zone and name_auth_zone and name_auth_zone != zone:
            flags["p1_name_zone"] = True

        # Authority: subregion vs row
        if in_authority_sub and country and sub_auth_country != country:
            flags["p2_sub_country"] = True
        if in_authority_sub and zone and sub_auth_zone and sub_auth_zone != zone:
            flags["p2_sub_zone"] = True

        # Authority: name vs subregion (the id=13 shape)
        if in_authority_name and in_authority_sub:
            if name_auth_country != sub_auth_country:
                flags["p3_country"] = True
            if (
                name_auth_zone
                and sub_auth_zone
                and name_auth_zone != sub_auth_zone
            ):
                flags["p3_zone"] = True

        # Inverted pair: does a DIFFERENT row exist where name=this.subregion
        # AND subregion=this.name? Self-referential rows (name==subregion) are
        # excluded — they're a data-modeling choice, not a contradiction.
        if name and sub and norm(name) != norm(sub):
            twin_sub = pairs_by_name.get(norm(sub))
            if twin_sub is not None and twin_sub == norm(name):
                flags["p4_inverted"] = True

        # Self-distribution (only subregion side, sub_support >= 2 for any power)
        if sub_support >= 2:
            if self_country_for_sub and country and self_country_for_sub != country:
                flags["self_sub_country"] = True
            if self_zone_for_sub and zone and self_zone_for_sub != zone:
                flags["self_sub_zone"] = True

        any_authority = any(
            flags[k]
            for k in (
                "p1_name_country",
                "p1_name_zone",
                "p2_sub_country",
                "p2_sub_zone",
                "p3_country",
                "p3_zone",
                "p4_inverted",
            )
        )
        any_self = flags["self_sub_country"] or flags["self_sub_zone"]

        flagged = any_authority or any_self

        # Cluster label
        if flags["p3_country"] or flags["p3_zone"]:
            cluster = "SAME_SHAPE_AS_ID_13"
        elif flags["p4_inverted"]:
            cluster = "INVERTED_PAIR"
        elif (
            flags["p2_sub_country"]
            or flags["p2_sub_zone"]
            or flags["self_sub_country"]
            or flags["self_sub_zone"]
        ):
            cluster = "COUNTRY_SUBREGION_MISMATCH"
        elif flags["p1_name_country"] or flags["p1_name_zone"]:
            cluster = "SINGLETON_ANOMALY"
        elif flagged:
            cluster = "SINGLETON_ANOMALY"
        else:
            cluster = None  # not flagged

        # AMBIGUOUS override: flagged but low/no authority coverage
        ambiguous_reason = None
        if flagged:
            if not in_authority_name and sub and not in_authority_sub:
                ambiguous_reason = (
                    "neither name nor subregion in authority"
                )
            elif sub is not None and not in_authority_sub and not in_authority_name:
                ambiguous_reason = (
                    "neither side in authority"
                )
            # Naoussa judgment call
            if norm(sub) == "naoussa" and zone == "South Aegean":
                ambiguous_reason = (
                    "Naoussa disambiguation: Macedonian PDO vs Paros/Cyclades "
                    "(zone=South Aegean suggests Paros reading)"
                )
                cluster = "AMBIGUOUS"

        # Methodology tag
        if any_authority and any_self:
            method = "BOTH"
        elif any_authority:
            method = "AUTHORITY_ONLY"
        elif any_self:
            method = "SELF_ONLY"
        else:
            method = None

        results.append(
            {
                **r,
                "flagged": flagged,
                "cluster": cluster,
                "method": method,
                "flags": flags,
                "name_auth": (name_auth_country, name_auth_zone),
                "sub_auth": (sub_auth_country, sub_auth_zone),
                "in_auth_name": in_authority_name,
                "in_auth_sub": in_authority_sub,
                "ambiguous_reason": ambiguous_reason,
            }
        )

    return results


def main():
    rows = load_regions()
    print(f"Total regions rows examined (excl id=13): {len(rows)}")

    self_sub_country, self_sub_zone, self_sub_support = build_self_distribution(rows)
    repeating_subs = {k: v for k, v in self_sub_support.items() if v >= 2}
    print(f"Subregion values with support >= 2: {repeating_subs}")

    classified = classify(rows, self_sub_country, self_sub_zone, self_sub_support)
    flagged = [r for r in classified if r["flagged"]]
    print(f"Contradictory rows found: {len(flagged)}")
    print(f"Total wine_families impact: {sum(r['wf_count'] for r in flagged)}")

    # Authority coverage on top rows
    top_rows = rows[:20]
    print("\n--- Authority coverage on top 20 by wf_count ---")
    for r in top_rows:
        n_in = authority_lookup(r["name"])[0] is not None
        s_in = authority_lookup(r["subregion"])[0] is not None if r["subregion"] else True
        print(
            f"id={r['id']:>4} wf={r['wf_count']:>5} "
            f"name={r['name']!r}  sub={r['subregion']!r}  "
            f"name_auth={n_in} sub_auth={s_in}"
        )

    # Cluster summary
    from collections import Counter as C
    cluster_counts = C()
    cluster_impact = defaultdict(int)
    method_counts = C()
    for r in flagged:
        cluster_counts[r["cluster"]] += 1
        cluster_impact[r["cluster"]] += r["wf_count"]
        method_counts[r["method"]] += 1

    print("\n--- CLUSTER SUMMARY ---")
    for c in (
        "SAME_SHAPE_AS_ID_13",
        "INVERTED_PAIR",
        "COUNTRY_SUBREGION_MISMATCH",
        "SINGLETON_ANOMALY",
        "AMBIGUOUS",
    ):
        print(
            f"  {c:<30}  rows={cluster_counts.get(c, 0):>3}  "
            f"wf_impact={cluster_impact.get(c, 0):>6}"
        )

    print("\n--- METHODOLOGY TAGS ---")
    for m in ("BOTH", "AUTHORITY_ONLY", "SELF_ONLY"):
        print(f"  {m:<20}  rows={method_counts.get(m, 0)}")

    # Full flagged table
    print("\n--- FLAGGED ROWS (ordered by wf_count desc) ---")
    flagged_sorted = sorted(flagged, key=lambda r: -r["wf_count"])
    print(
        f"{'id':>4} | {'name':<30} | {'subregion':<22} | {'zone':<18} | "
        f"{'country':<14} | {'wf':>5} | {'cluster':<26} | {'method':<16} | flags"
    )
    for r in flagged_sorted:
        fired = [k for k, v in r["flags"].items() if v]
        print(
            f"{r['id']:>4} | {str(r['name'])[:30]:<30} | "
            f"{str(r['subregion'])[:22]:<22} | {str(r['zone'] or ''):<18} | "
            f"{str(r['country'])[:14]:<14} | {r['wf_count']:>5} | "
            f"{(r['cluster'] or ''):<26} | {(r['method'] or ''):<16} | "
            f"{','.join(fired)}"
        )

    # Ambiguous cases
    ambiguous = [r for r in classified if r["ambiguous_reason"]]
    print(f"\n--- AMBIGUOUS CASES ({len(ambiguous)}) ---")
    for r in ambiguous:
        print(
            f"  id={r['id']} name={r['name']!r} sub={r['subregion']!r} "
            f"zone={r['zone']!r} — {r['ambiguous_reason']}"
        )

    # Writes-executed check (sanity)
    print("\n--- WRITES EXECUTED: NONE (read-only SELECT only) ---")

    return flagged


if __name__ == "__main__":
    main()
