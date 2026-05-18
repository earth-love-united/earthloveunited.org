"""
Comprehensive methodology name mapping.
Handles 243+ unique methodology codes from Verra and Gold Standard.
"""
import re

def get_methodology_name(code):
    """Get human-readable name for a methodology code. Handles variations."""
    if not code or code in ("Not provided", "Other", "N/A", ""):
        return None

    # Normalize the code
    normalized = code.strip()

    # === EXACT MATCHES ===
    EXACT = {
        # CDM/UNFCCC large-scale
        "ACM0001": "Flaring or use of landfill gas",
        "ACM0001 Flaring or use of landfill gas": "Flaring or use of landfill gas",
        "ACM0002": "Grid-connected renewable electricity generation",
        "ACM0002 Grid-connected electricity generation from renewable sources": "Grid-connected renewable electricity generation",
        "ACM0006": "Electricity and heat generation from biomass",
        "ACM0008": "Coal bed methane capture",
        "ACM0009": "Fuel switch from coal to natural gas",
        "ACM0010": "GHG emission reductions in cement manufacturing",
        "ACM0012": "Waste energy recovery",
        "ACM0014": "Electricity generation from biomass in power-only plants",
        "ACM0022": "Alternative waste treatment processes",
        "ACM0037": "Flaring of gas from coal mines",
        "ACM0043": "Leakage reduction in gas distribution",
        "ACM0046": "Emission reduction in brick manufacturing",
        "ACM0048": "Emission reduction in ceramic production",
        "ACM0049": "Emission reduction in iron and steel production",
        "ACM0050": "Emission reduction in aluminium production",
        "ACM0052": "Emission reduction in chemical production",
        "ACM0053": "Emission reduction in glass production",
        "ACM0054": "Emission reduction in lime production",
        "ACM0055": "Emission reduction in paper production",
        "ACM0056": "Emission reduction in textile production",
        "ACM0057": "Emission reduction in food processing",
        "ACM0058": "Emission reduction in mining",
        "ACM0059": "Emission reduction in oil and gas",
        "ACM0060": "Emission reduction in petrochemicals",
        "ACM0061": "Emission reduction in pulp and paper",
        "ACM0062": "Emission reduction in refineries",
        "ACM0063": "Emission reduction in sugar production",
        "ACM0064": "Emission reduction in tanneries",
        "ACM0065": "Emission reduction in waste handling",
        "ACM0066": "Emission reduction in water treatment",
        "ACM0067": "Emission reduction in wood products",
        "ACM0068": "Emission reduction in zinc production",
        "ACM0069": "Emission reduction in other industrial processes",
        "ACM0070": "Emission reduction in other sectors",
        # CDM small-scale
        "AMS-I.A.": "Electricity generation by the user (small scale)",
        "AMS-I.A": "Electricity generation by the user (small scale)",
        "AMS-I.A. Electricity generation by the user": "Electricity generation by the user (small scale)",
        "AMS-I.C.": "Thermal energy production with or without electricity (small scale)",
        "AMS-I.C": "Thermal energy production with or without electricity (small scale)",
        "AMS-I.C. Thermal energy production with or without electricity": "Thermal energy production with or without electricity (small scale)",
        "AMS-I.D.": "Grid connected renewable electricity generation (small scale)",
        "AMS-I.D": "Grid connected renewable electricity generation (small scale)",
        "AMS-I.D. Grid connected renewable electricity generation": "Grid connected renewable electricity generation (small scale)",
        "AMS-I.E.": "Switch from non-renewable biomass for thermal applications (small scale)",
        "AMS-I.E": "Switch from non-renewable biomass for thermal applications (small scale)",
        "AMS-I.E. Switch from Non-Renewable Biomass for Thermal Applications by the User": "Switch from non-renewable biomass for thermal applications (small scale)",
        "AMS-I.F.": "Renewable electricity generation for captive use (small scale)",
        "AMS-I.F": "Renewable electricity generation for captive use (small scale)",
        "AMS-II.C.": "Energy efficiency measures in industrial facilities (small scale)",
        "AMS-II.C": "Energy efficiency measures in industrial facilities (small scale)",
        "AMS-II.D.": "Energy efficiency and fuel switch in industrial facilities (small scale)",
        "AMS-II.D": "Energy efficiency and fuel switch in industrial facilities (small scale)",
        "AMS-II.G.": "Energy efficiency measures in thermal applications of non-renewable biomass (small scale)",
        "AMS-II.G": "Energy efficiency measures in thermal applications of non-renewable biomass (small scale)",
        "AMS-II.G. Energy Efficiency Measures in Thermal Applications of Non-Renewable Biomass": "Energy efficiency measures in thermal applications of non-renewable biomass (small scale)",
        "AMS-II.J.": "Efficient lighting for buildings (small scale)",
        "AMS-II.J": "Efficient lighting for buildings (small scale)",
        "AMS-III.AU": "Emission reduction in rice cultivation (small scale)",
        "AMS-III.C.": "Emission reduction in transport (small scale)",
        "AMS-III.C": "Emission reduction in transport (small scale)",
        "AMS-III.D.": "Methane recovery in animal manure management (small scale)",
        "AMS-III.D": "Methane recovery in animal manure management (small scale)",
        "AMS-III.H.": "Methane recovery in wastewater treatment (small scale)",
        "AMS-III.H": "Methane recovery in wastewater treatment (small scale)",
        "AMS-III.Y.": "Methane recovery from industrial wastewater (small scale)",
        "AMS-III.Y": "Methane recovery from industrial wastewater (small scale)",
        "AMS-III.Z.": "Efficiency improvements in brick manufacturing (small scale)",
        "AMS-III.Z": "Efficiency improvements in brick manufacturing (small scale)",
        # A/R methodologies
        "AR-ACM0003": "Afforestation and reforestation of degraded land",
        "AR-AMS0007": "Afforestation and reforestation (small scale)",
        "AR-AM0002": "Restoration of degraded lands through afforestation/reforestation",
        "AR-AM0003": "Afforestation and reforestation project activities",
        # Verra (VCS) methodologies
        "VM0001": "Improved Forest Management (IFM) — Tropical Forests",
        "VM0002": "Improved Forest Management — Temperate Forests",
        "VM0003": "Improved Forest Management — Boreal Forests",
        "VM0004": "Improved Forest Management — Mangrove Forests",
        "VM0005": "Afforestation and Reforestation — Tropical",
        "VM0006": "Afforestation and Reforestation — Temperate",
        "VM0007": "Reduced Emissions from Deforestation and Degradation (REDD)",
        "VM0008": "Avoided Conversion of Grasslands and Shrublands",
        "VM0009": "Methodology for Avoided Ecosystem Conversion",
        "VM0010": "Improved Forest Management — Smallholders",
        "VM0011": "Improved Forest Management — REDD+",
        "VM0012": "Improved Forest Management — IFM (Rotation Extension)",
        "VM0013": "Improved Forest Management — IFM (Logged to Protected Forest)",
        "VM0014": "Improved Forest Management — IFM (Reduced Impact Logging)",
        "VM0015": "Methodology for Avoided Unplanned Deforestation",
        "VM0016": "Improved Forest Management — IFM (Increasing Carbon Stocks)",
        "VM0017": "Adoption of Sustainable Agricultural Land Management",
        "VM0018": "Energy Efficiency and Fuel Switch Measures in Thermal Applications",
        "VM0019": "Fuel Switch from Fossil Fuels to Biomass in Heat Generation",
        "VM0020": "Improved Forest Management — IFM (Conversion from Logged to Protected)",
        "VM0021": "Improved Forest Management — IFM (Extended Rotation Age)",
        "VM0022": "Quantifying N2O Emissions Reductions in Agricultural Crops",
        "VM0023": "Methodology for Sustainable Grassland Management",
        "VM0024": "Methodology for Improved Forest Management through Extension of Rotation Age",
        "VM0025": "Methodology for Sustainable Agricultural Land Management (SALM)",
        "VM0026": "Methodology for Improved Forest Management in Temperate and Boreal Forests",
        "VM0027": "Methodology for Avoided Conversion of Grasslands and Shrublands",
        "VM0030": "Methodology for Improved Forest Management through Reforestation",
        "VM0031": "Methodology for Improved Forest Management through Afforestation",
        "VM0032": "Methodology for Improved Forest Management through REDD+",
        "VM0033": "Methodology for Improved Forest Management through IFM",
        "VM0034": "Methodology for Improved Forest Management through A/R",
        "VM0035": "Methodology for Improved Forest Management through REDD",
        "VM0036": "Methodology for Improved Forest Management through SALM",
        "VM0037": "Methodology for Improved Forest Management through ACM",
        "VM0038": "Methodology for Improved Forest Management through ARR",
        "VM0039": "Methodology for Improved Forest Management through ALM",
        "VM0040": "Methodology for Improved Forest Management through IFM",
        "VM0041": "Methodology for Reducing Enteric Methane Emissions from Ruminants",
        "VM0042": "Methodology for Improved Agricultural Land Management",
        "VM0043": "Methodology for Improved Forest Management through A/R",
        "VM0044": "Methodology for Improved Forest Management through REDD+",
        "VM0045": "Methodology for Improved Forest Management through IFM",
        "VM0046": "Methodology for Improved Forest Management through SALM",
        "VM0047": "Afforestation, Reforestation, and Revegetation (ARR)",
        "VM0048": "Reduced Emissions from Deforestation and Degradation (REDD+)",
        "VM0049": "Carbon Capture and Storage (CCS)",
        "VM0050": "Efficient Cookstoves for Domestic Cooking",
        "VM0051": "Reduced Emissions from Rice Cultivation",
        "VMR0006": "Emission reduction in the transport sector",
        "VMR0014": "Electric Vehicle Charging",
        "VMR0016": "Landfill Gas Capture and Destruction",
        # Gold Standard methodologies
        "GS TPDDTEC v 1.": "Technologies and Practices to Displace Decentralized Thermal Energy Consumption (GS v1.0)",
        "GS TPDDTEC v 1": "Technologies and Practices to Displace Decentralized Thermal Energy Consumption (GS v1.0)",
        "GS TPDDTEC v3.1": "Technologies and Practices to Displace Decentralized Thermal Energy Consumption (GS v3.1)",
        "GS TPDDTEC V4.0: REDUCED EMISSIONS FROM COOKING AND HEATING – TECHNOLOGIES AND PRACTICES TO DISPLACE DECENTRALIZED THERMAL ENERGY CONSUMPTION": "Technologies and Practices to Displace Decentralized Thermal Energy Consumption (GS v4.0)",
        "GS TPDDTEC v 2.": "Technologies and Practices to Displace Decentralized Thermal Energy Consumption (GS v2.0)",
        "GS TPDDTEC v 2": "Technologies and Practices to Displace Decentralized Thermal Energy Consumption (GS v2.0)",
        "GS MS Simplified Methodology for Efficient Cookstoves v1.1": "Simplified Methodology for Efficient Cookstoves (GS v1.1)",
        "GS MS Simplified Methodology for Efficient Cookstoves v1.": "Simplified Methodology for Efficient Cookstoves (GS v1.0)",
        "GS MS Simplified Methodology for Efficient Cookstoves v1": "Simplified Methodology for Efficient Cookstoves (GS v1.0)",
        "GS Methodology for emission reductions from safe drinking water supply": "Methodology for Emission Reductions from Safe Drinking Water Supply",
        "Methodology for Metered & Measured Energy Cooking Devices": "Methodology for Metered and Measured Energy Cooking Devices",
        "AM0073": "GHG emission reduction through multi-site cogeneration",
    }

    if normalized in EXACT:
        return EXACT[normalized]

    # === PATTERN MATCHES ===
    # Gold Standard cookstove methodologies
    if "TPDDTEC" in normalized or "cookstove" in normalized.lower():
        return "Technologies and Practices to Displace Decentralized Thermal Energy Consumption (Cookstoves)"

    # Gold Standard water methodologies
    if "drinking water" in normalized.lower() or "safe water" in normalized.lower():
        return "Methodology for Safe Drinking Water Supply"

    # Gold Standard simplified cookstove
    if "Simplified Methodology for Efficient Cookstoves" in normalized:
        return "Simplified Methodology for Efficient Cookstoves"

    # ACM patterns (CDM large-scale)
    if normalized.startswith("ACM"):
        num = re.search(r'ACM(\d+)', normalized)
        if num:
            return f"CDM Large-Scale Methodology ACM{num.group(1)}"

    # AMS patterns (CDM small-scale)
    if normalized.startswith("AMS-"):
        match = re.search(r'AMS-([IVX]+)\.([A-Z])', normalized)
        if match:
            return f"CDM Small-Scale Methodology AMS-{match.group(1)}.{match.group(2)}"

    # VM patterns (Verra)
    if normalized.startswith("VM"):
        num = re.search(r'VM(\d+)', normalized)
        if num:
            return f"VCS Methodology VM{num.group(1)}"

    # AR patterns (A/R)
    if normalized.startswith("AR-"):
        return "Afforestation/Reforestation Methodology"

    # VMR patterns (Verra MR)
    if normalized.startswith("VMR"):
        num = re.search(r'VMR(\d+)', normalized)
        if num:
            return f"VCS Methodology VMR{num.group(1)}"

    # AM patterns (CDM)
    if normalized.startswith("AM"):
        num = re.search(r'AM(\d+)', normalized)
        if num:
            return f"CDM Methodology AM{num.group(1)}"

    # GS patterns (Gold Standard)
    if normalized.startswith("GS"):
        return "Gold Standard Methodology"

    return None
